'use strict';

const fs = require('fs');
const path = require('path');

const { loadPreviousSnapshot, mergeFreeListHistory } = require('../free-models-history');
const {
  shouldFetchRankingsDaily,
  attachPopularity,
  matchRankingsDaily,
  relativeRankFromTopWeekly,
  pickLatestRankingsDay,
} = require('../free-models-popularity');
const {
  isFreePricing,
  createOpenRouterAdapter,
} = require('./openrouter');
const { createGroqAdapter } = require('./groq');
const { createCerebrasAdapter } = require('./cerebras');
const { createGoogleAdapter } = require('./google');
const { createMistralAdapter } = require('./mistral');
const { createGitHubModelsAdapter } = require('./github-models');
const { createHuggingFaceAdapter } = require('./huggingface');
const { createNvidiaNimAdapter } = require('./nvidia-nim');
const { createAmdTokenFactoryAdapter } = require('./amd-tokenfactory');
const { createRegistry } = require('./registry');
const {
  collectProvider,
  writeProviderOutputs,
  writeFreeModelsAggregate,
} = require('./emit');

const DEFAULT_PROVIDER_TIMEOUT_MS = 30000;

/**
 * Build a registry with every known provider adapter registered in
 * canonical order.
 */
function defaultRegistry() {
  const registry = createRegistry();
  registry.registerProvider(createOpenRouterAdapter());
  registry.registerProvider(createGroqAdapter());
  registry.registerProvider(createCerebrasAdapter());
  registry.registerProvider(createGoogleAdapter());
  registry.registerProvider(createMistralAdapter());
  registry.registerProvider(createGitHubModelsAdapter());
  registry.registerProvider(createHuggingFaceAdapter());
  registry.registerProvider(createNvidiaNimAdapter());
  registry.registerProvider(createAmdTokenFactoryAdapter());
  return registry;
}

/**
 * Parse a comma-separated provider id list ("a,b,c") into a trimmed,
 * de-duplicated array. Empty/undefined input yields null (= all providers).
 *
 * @param {string | string[] | undefined} value Env var value or pre-split list.
 * @returns {string[] | null}
 */
function parseProviderSelection(value) {
  if (value === undefined || value === null) return null;
  const ids = (Array.isArray(value) ? value : String(value).split(','))
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  return ids.length === 0 ? null : [...new Set(ids)];
}

function parseTimeoutMs(value, fallback = DEFAULT_PROVIDER_TIMEOUT_MS) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Reject after `timeoutMs` unless the promise settles first. The timer is
 * always cleared so it can never keep the event loop alive.
 *
 * Note: the losing (e.g. hung) promise is abandoned, not cancelled — adapters
 * do not accept an AbortSignal, so the underlying fetch keeps running in the
 * background until it settles on its own. Its eventual settlement is safely
 * ignored (Promise.race attaches handlers to every input), so this can never
 * produce an unhandled rejection; the process may simply linger until the
 * abandoned fetch's sockets/timers drain.
 */
async function withTimeout(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Multi-provider updater runner.
 *
 * Iterates the enabled adapters of the registry and runs fetch+normalize per
 * provider independently: one provider failing never blocks the others.
 * Successful collections are emitted as per-provider JSON files plus a merged
 * index (via emit.js), and the legacy OpenRouter snapshot is refreshed when
 * OpenRouter succeeded.
 *
 * Exit-code semantics: the returned summary's `exitCode` is non-zero only when
 * zero providers succeeded.
 *
 * @param {Object} [options]
 * @param {Object} [options.registry] Registry to iterate; defaults to all built-in adapters.
 * @param {string[] | null} [options.providers] Provider id allow-list; null = all.
 * @param {number} [options.timeoutMs] Per-provider fetch timeout (default 30s).
 * @param {string} [options.outputDir] Per-provider output directory; omit to skip emitting.
 * @param {string} [options.aggregateOutputPath] Override the aggregate free_models.json location.
 * @param {string} [options.legacyOutputPath] Override the legacy OpenRouter snapshot location.
 * @param {typeof fs} [options.io] Filesystem module (for tests).
 * @param {() => string} [options.now] Injectable clock for fetchedAt stamps.
 * @param {(msg: string) => void} [options.log] Progress logger.
 * @param {(msg: string) => void} [options.warn] Warning logger.
 * @param {(adapter: Object, models: Object[], fetchedAt: string) => Promise<void>} [options.writeLegacy]
 *   Legacy snapshot writer override (for tests).
 * @returns {Promise<{succeeded: string[], failed: {id: string, error: string}[],
 *   skipped: Array<{id: string, reason: string}>, exitCode: number,
 *   files?: string[], index?: Object, pruned?: string[],
 *   aggregatePath?: string, legacyPath?: string}>}
 */
async function runUpdate({
  registry = defaultRegistry(),
  providers = parseProviderSelection(process.env.PROVIDERS),
  timeoutMs = parseTimeoutMs(process.env.PROVIDER_TIMEOUT_MS),
  outputDir = path.join(__dirname, '..', '..', 'web', 'public', 'models'),
  aggregateOutputPath: aggregatePathOverride = freeModelsAggregatePath(),
  legacyOutputPath: legacyPathOverride,
  io = fs,
  now = () => new Date().toISOString(),
  log = (msg) => console.log(msg),
  warn = (msg) => console.warn(msg),
  writeLegacy = writeLegacyOpenRouterSnapshot,
} = {}) {
  const succeeded = [];
  const failed = [];
  const skipped = [];

  const selected = registry.getProviders().filter(
    (adapter) => !providers || providers.includes(adapter.id)
  );

  // Explicitly requested-but-unknown provider ids are reported as skipped.
  const knownIds = new Set(selected.map((a) => a.id));
  for (const id of providers ?? []) {
    if (!knownIds.has(id)) skipped.push({ id, reason: 'unknown-provider' });
  }

  const results = [];
  for (const adapter of selected) {
    log(`Fetching models from ${adapter.name}...`);
    let result;
    try {
      result = await withTimeout(collectProvider(adapter, { now }), timeoutMs, adapter.id);
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      warn(`Provider ${adapter.id} failed: ${message}`);
      failed.push({ id: adapter.id, error: message });
      continue;
    }

    if (result.ok) {
      log(`Found ${result.models.length} free models on ${result.name}`);
      succeeded.push(result.providerId);
      results.push(result);
    } else if (result.reason === 'missing-api-key') {
      warn(`Skipping ${result.providerId}: API key not configured`);
      skipped.push({ id: result.providerId, reason: result.reason });
    } else {
      const message = result.error ?? result.reason;
      warn(`Provider ${result.providerId} failed: ${message}`);
      failed.push({ id: result.providerId, error: message });
    }
  }

  let legacyPath;
  const openrouter = results.find((r) => r.providerId === 'openrouter');
  if (openrouter) {
    try {
      legacyPath = await writeLegacy({
        adapter: registry.getProvider('openrouter'),
        freeModels: openrouter.models,
        fetchedAt: openrouter.fetchedAt,
        io,
        log,
        warn,
        outputPath: legacyPathOverride,
      });
    } catch (err) {
      warn(`legacy snapshot update failed: ${err.message}`);
    }
  }

  applyHistoryMerges({ results, outputDir, io, warn });

  let emitted;
  if (results.length > 0) {
    emitted = writeProviderOutputs({ results, outputDir, io });
    emitted.files.forEach((f) => log(`Written to: ${f}`));
    if (emitted.pruned.length > 0) {
      emitted.pruned.forEach((id) => warn(`Pruned stale provider file: ${id}.json`));
    }
    log(
      `Emitted ${results.length} provider file(s)` +
        (skipped.length > 0 ? `, skipped ${skipped.length}` : '')
    );

    // Aggregate artifact for the frontend (ModelsData shape), built from the
    // history-enriched results. Legacy snapshot generation above stays
    // untouched and isolated.
    const aggregate = writeFreeModelsAggregate({
      results,
      outputPath: aggregatePathOverride,
      io,
    });
    log(`Written to: ${aggregate.path}`);
    emitted.aggregatePath = aggregate.path;
  }

  return {
    succeeded,
    failed,
    skipped,
    exitCode: succeeded.length === 0 ? 1 : 0,
    ...emitted,
    legacyPath,
  };
}

/**
 * Merge each successful provider's models against that provider's own
 * history slice (its previous per-provider output file), replacing the
 * collected models with history-stamped ones and attaching
 * `{ archivedModels, newModelIds }` for emit.
 *
 * A corrupt previous slice is treated as missing (fresh history) rather than
 * failing the provider; the warning is surfaced through `warn`.
 */
function applyHistoryMerges({ results, outputDir, io, warn }) {
  for (const result of results) {
    const filePath = path.join(outputDir, `${result.providerId}.json`);
    let previous = null;
    try {
      previous = loadPreviousSnapshot(filePath, io);
    } catch (err) {
      warn(`previous history for ${result.providerId} unreadable, starting fresh: ${err.message}`);
    }

    let merged;
    try {
      merged = mergeFreeListHistory(previous, result.models, result.fetchedAt, {
        providerId: result.providerId,
      });
    } catch (err) {
      // A merge failure (e.g. an id containing the key separator) must not
      // take down other providers: emit this slice unstamped instead.
      warn(`history merge for ${result.providerId} failed, emitting without history: ${err.message}`);
      continue;
    }
    result.models = merged.models;
    result.history = {
      archivedModels: merged.archivedModels,
      newModelIds: merged.newModelIds,
    };
  }
}

/**
 * Build the legacy `web/public/openrouter_free_models.json` payload
 * (history merge + popularity) without writing it, so the format stays
 * byte-compatible with the pre multi-provider updater.
 */
async function buildLegacyOpenRouterOutput(
  adapter,
  freeModels,
  fetchedAt,
  { io = fs, outputPath = legacyOutputPath(), log = (m) => console.log(m), warn = (m) => console.warn(m) } = {}
) {
  const previous = loadPreviousSnapshot(outputPath, io);
  const { models, archivedModels, newModelIds } = mergeFreeListHistory(
    previous,
    freeModels,
    fetchedAt,
    { providerId: 'openrouter' }
  );

  let rankingsDaily = null;
  if (shouldFetchRankingsDaily(adapter.hasApiKey())) {
    try {
      rankingsDaily = await adapter.fetchRankingsDaily();
      log('Fetched rankings-daily');
    } catch (err) {
      warn(`rankings-daily fetch failed: ${err.message}`);
    }
  } else {
    log('Skipping rankings-daily (no OPENROUTER_API_KEY)');
  }

  let topWeekly = null;
  try {
    topWeekly = await adapter.fetchTopWeekly();
    log(`Fetched top-weekly (${topWeekly.length} models)`);
  } catch (err) {
    warn(`top-weekly fetch failed: ${err.message}`);
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
  return path.join(__dirname, '..', '..', 'web', 'public', 'openrouter_free_models.json');
}

function freeModelsAggregatePath() {
  return path.join(__dirname, '..', '..', 'web', 'public', 'free_models.json');
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
  log = (m) => console.log(m),
  warn = (m) => console.warn(m),
}) {
  const legacyPath = outputPath ?? legacyOutputPath();
  io.mkdirSync(path.dirname(legacyPath), { recursive: true });
  const { output, archivedModels, newModelIds } = await buildLegacyOpenRouterOutput(
    adapter,
    freeModels,
    fetchedAt,
    { io, outputPath: legacyPath, log, warn }
  );
  const tmpPath = `${legacyPath}.tmp`;
  io.writeFileSync(tmpPath, JSON.stringify(output, null, 2), 'utf8');
  io.renameSync(tmpPath, legacyPath);
  log(`Written to: ${legacyPath}`);
  log(`Archived models: ${archivedModels.length}`);

  if (newModelIds.length > 0) {
    log(`New models detected: ${newModelIds.length}`);
    newModelIds.forEach((id) => log(`  - ${id}`));
  }
  return legacyPath;
}

module.exports = {
  isFreePricing,
  loadPreviousSnapshot,
  mergeFreeListHistory,
  shouldFetchRankingsDaily,
  attachPopularity,
  matchRankingsDaily,
  relativeRankFromTopWeekly,
  pickLatestRankingsDay,
  buildLegacyOpenRouterOutput,
  writeLegacyOpenRouterSnapshot,
  defaultRegistry,
  parseProviderSelection,
  parseTimeoutMs,
  runUpdate,
  freeModelsAggregatePath,
};
