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

const adapter = createOpenRouterAdapter();

module.exports = {
  isFreePricing,
  loadPreviousSnapshot,
  mergeFreeListHistory,
  shouldFetchRankingsDaily,
  attachPopularity,
  matchRankingsDaily,
  relativeRankFromTopWeekly,
  pickLatestRankingsDay,
};

async function main() {
  try {
    console.log('Fetching models from OpenRouter...');
    console.log(`Auth: ${adapter.hasApiKey() ? 'OPENROUTER_API_KEY' : 'none (public models endpoint)'}`);

    const data = await adapter.fetchModels();
    const freeModels = data
      .filter((m) => adapter.isFree(m))
      .map((m) => adapter.normalize(m));

    console.log(`Found ${freeModels.length} free models`);

    const outputPath = path.join(__dirname, 'web', 'public', 'openrouter_free_models.json');
    const previous = loadPreviousSnapshot(outputPath);
    const fetchedAt = new Date().toISOString();
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

    const output = {
      fetchedAt,
      totalModels: modelsWithPopularity.length,
      newModelIds,
      models: modelsWithPopularity,
      archivedModels,
    };

    const webPublicDir = path.join(__dirname, 'web', 'public');
    if (!fs.existsSync(webPublicDir)) {
      fs.mkdirSync(webPublicDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`Written to: ${outputPath}`);
    console.log(`Archived models: ${archivedModels.length}`);

    if (newModelIds.length > 0) {
      console.log(`New models detected: ${newModelIds.length}`);
      newModelIds.forEach((id) => console.log(`  - ${id}`));
    }

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
