require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');

const { loadPreviousSnapshot, mergeFreeListHistory } = require('./lib/free-models-history');
const {
  shouldFetchRankingsDaily,
  attachPopularity,
  matchRankingsDaily,
  relativeRankFromTopWeekly,
  pickLatestRankingsDay,
} = require('./lib/free-models-popularity');
const {
  isFreePricing,
  createOpenRouterAdapter,
} = require('./lib/providers/openrouter');
const { createGroqAdapter } = require('./lib/providers/groq');
const { createGoogleAdapter } = require('./lib/providers/google');
const { createRegistry } = require('./lib/providers/registry');
const {
  collectProvider,
  writeProviderOutputs,
} = require('./lib/providers/emit');

const registry = createRegistry();
registry.registerProvider(createOpenRouterAdapter());
registry.registerProvider(createGroqAdapter());
registry.registerProvider(createGoogleAdapter());

module.exports = {
  isFreePricing,
  loadPreviousSnapshot,
  mergeFreeListHistory,
  shouldFetchRankingsDaily,
  attachPopularity,
  matchRankingsDaily,
  relativeRankFromTopWeekly,
  pickLatestRankingsDay,
  registry,
  buildLegacyOpenRouterOutput,
  writeLegacyOpenRouterSnapshot,
};

/**
 * Build the legacy `web/public/openrouter_free_models.json` payload
 * (history merge + popularity) without writing it, so the format stays
 * byte-compatible with the pre multi-provider updater.
 */
async function buildLegacyOpenRouterOutput(
  adapter,
  freeModels,
  fetchedAt,
  { io = fs, outputPath = legacyOutputPath() } = {}
) {
  const previous = loadPreviousSnapshot(outputPath, io);
  const { models, archivedModels, newModelIds } = mergeFreeListHistory(
    previous,
    freeModels,
    fetchedAt
  );

  let rankingsDaily = null;
  if (shouldFetchRankingsDaily(adapter.hasApiKey())) {
    try {
      rankingsDaily = await adapter.fetchRankingsDaily();
      console.log('Fetched rankings-daily');
    } catch (err) {
      console.warn(`rankings-daily fetch failed: ${err.message}`);
    }
  } else {
    console.log('Skipping rankings-daily (no OPENROUTER_API_KEY)');
  }

  let topWeekly = null;
  try {
    topWeekly = await adapter.fetchTopWeekly();
    console.log(`Fetched top-weekly (${topWeekly.length} models)`);
  } catch (err) {
    console.warn(`top-weekly fetch failed: ${err.message}`);
  }

  const modelsWithPopularity = attachPopularity({
    models,
    rankingsDaily,
    topWeekly,
    asOf: fetchedAt,
    hasApiKey: adapter.hasApiKey(),
  });

  return {
    outputPath,
    output: {
      fetchedAt,
      totalModels: modelsWithPopularity.length,
      newModelIds,
      models: modelsWithPopularity,
      archivedModels,
    },
    archivedModels,
    newModelIds,
  };
}

function legacyOutputPath() {
  return path.join(__dirname, 'web', 'public', 'openrouter_free_models.json');
}

/**
 * Write the legacy OpenRouter snapshot for backward compatibility.
 *
 * @param {Object} params
 * @param {Object} params.adapter OpenRouter adapter.
 * @param {Object[]} params.freeModels Normalized free models.
 * @param {string} params.fetchedAt ISO timestamp.
 * @param {typeof fs} [params.io]
 * @param {string} [params.outputPath] Override the legacy file location.
 * @returns {Promise<string>} Path written.
 */
async function writeLegacyOpenRouterSnapshot({
  adapter,
  freeModels,
  fetchedAt,
  io = fs,
  outputPath,
}) {
  const legacyPath = outputPath ?? legacyOutputPath();
  fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
  const { output, archivedModels, newModelIds } = await buildLegacyOpenRouterOutput(
    adapter,
    freeModels,
    fetchedAt,
    { io, outputPath: legacyPath }
  );
  const tmpPath = `${legacyPath}.tmp`;
  io.writeFileSync(tmpPath, JSON.stringify(output, null, 2), 'utf8');
  io.renameSync(tmpPath, legacyPath);
  console.log(`Written to: ${legacyPath}`);
  console.log(`Archived models: ${archivedModels.length}`);

  if (newModelIds.length > 0) {
    console.log(`New models detected: ${newModelIds.length}`);
    newModelIds.forEach((id) => console.log(`  - ${id}`));
  }
  return legacyPath;
}

async function main() {
  const results = [];
  const skipped = [];

  for (const adapter of registry.getProviders()) {
    console.log(`Fetching models from ${adapter.name}...`);
    const result = await collectProvider(adapter);
    if (result.ok) {
      console.log(`Found ${result.models.length} free models on ${adapter.name}`);
      results.push(result);
    } else if (result.reason === 'missing-api-key') {
      console.warn(`Skipping ${adapter.id}: API key not configured`);
      skipped.push(result);
    } else {
      console.warn(`Skipping ${adapter.id}: ${result.error}`);
      skipped.push(result);
    }
  }

  const openrouter = results.find((r) => r.providerId === 'openrouter');
  if (openrouter) {
    try {
      await writeLegacyOpenRouterSnapshot({
        adapter: registry.getProvider('openrouter'),
        freeModels: openrouter.models,
        fetchedAt: openrouter.fetchedAt,
      });
    } catch (error) {
      console.warn(`legacy snapshot update failed: ${error.message}`);
    }
  }

  if (results.length === 0) {
    console.error('Error: no providers succeeded; nothing emitted.');
    process.exit(1);
  }

  const outputDir = path.join(__dirname, 'web', 'public', 'models');
  const { files, pruned } = writeProviderOutputs({ results, outputDir });
  files.forEach((f) => console.log(`Written to: ${f}`));
  if (pruned.length > 0) {
    pruned.forEach((id) => console.warn(`Pruned stale provider file: ${id}.json`));
  }

  console.log(
    `Emitted ${results.length} provider file(s)` +
      (skipped.length > 0 ? `, skipped ${skipped.length}` : '')
  );
  console.log('Done!');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
