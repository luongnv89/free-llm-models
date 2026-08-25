'use strict';

const fs = require('fs');

/**
 * Fetch + normalize one provider's free-model catalog through the shared
 * emit path. Never throws: failures are reported as `{ ok: false }` so a
 * single broken provider cannot break the others.
 *
 * @param {ProviderAdapter} adapter Adapter (see lib/providers/registry.js).
 * @param {Object} [options]
 * @param {() => string} [options.now] Injectable clock (ISO string).
 * @returns {Promise<{ok: true, providerId: string, name: string,
 *   metadata: Object, fetchedAt: string, models: Object[]} |
 *   {ok: false, providerId: string, reason: 'missing-api-key'|'fetch-failed',
 *   error?: string}>}
 */
async function collectProvider(adapter, { now = () => new Date().toISOString() } = {}) {
  const keyless =
    typeof adapter.hasApiKey === 'function' &&
    !adapter.hasApiKey() &&
    adapter.allowKeylessFetch !== true;

  if (keyless) {
    return { ok: false, providerId: adapter.id, reason: 'missing-api-key' };
  }

  try {
    const rawModels = await adapter.fetchModels();
    const models = rawModels
      .filter((m) => adapter.isFree(m))
      .map((m) => adapter.normalize(m));
    return {
      ok: true,
      providerId: adapter.id,
      name: adapter.name,
      metadata: adapter.metadata,
      fetchedAt: now(),
      models,
    };
  } catch (err) {
    return {
      ok: false,
      providerId: adapter.id,
      reason: 'fetch-failed',
      error: err && err.message ? err.message : String(err),
    };
  }
}

/**
 * Collect every registered provider, skipping (not failing) the ones whose
 * API key is missing or whose fetch fails.
 *
 * @param {ProviderAdapter[]} adapters
 * @param {Object} [options]
 * @param {() => string} [options.now]
 * @returns {Promise<{results: Object[], skipped: Object[]}>}
 */
async function collectAllProviders(adapters, options = {}) {
  const results = [];
  const skipped = [];
  for (const adapter of adapters) {
    const result = await collectProvider(adapter, options);
    if (result.ok) {
      results.push(result);
    } else {
      skipped.push(result);
    }
  }
  return { results, skipped };
}

/**
 * Build the merged index document from successful provider collections.
 *
 * Shape: `{ providers: [{id, name, metadata, modelCount, fetchedAt}],
 * models: [...all models...] }`.
 *
 * @param {{providerId: string, name: string, metadata: Object,
 *   fetchedAt: string, models: Object[]}[]} results
 */
function buildIndex(results) {
  return {
    providers: results.map((r) => ({
      id: r.providerId,
      name: r.name,
      metadata: r.metadata,
      modelCount: r.models.length,
      fetchedAt: r.fetchedAt,
    })),
    models: results.flatMap((r) => r.models),
  };
}

/**
 * Write per-provider JSON files plus the merged index.
 *
 * Per-provider file: `<outputDir>/<providerId>.json` shaped
 * `{ providerId, fetchedAt, models }`.
 * Index file: `<outputDir>/index.json` shaped like `buildIndex`.
 *
 * @param {Object} params
 * @param {Object[]} params.results Successful collectProvider results.
 * @param {string} params.outputDir Directory for the emitted files.
 * @param {string} [params.indexFileName] Defaults to 'index.json'.
 * @param {typeof fs} [params.io] Filesystem module (for tests).
 * @returns {{files: string[], index: Object}} Written file paths and index doc.
 */
function writeProviderOutputs({ results, outputDir, indexFileName = 'index.json', io = fs }) {
  io.mkdirSync(outputDir, { recursive: true });

  const files = [];
  const writtenIds = new Set();
  for (const result of results) {
    const filePath = `${outputDir}/${result.providerId}.json`;
    writeFileAtomic(
      io,
      filePath,
      JSON.stringify(
        { providerId: result.providerId, fetchedAt: result.fetchedAt, models: result.models },
        null,
        2
      )
    );
    files.push(filePath);
    writtenIds.add(result.providerId);
  }

  // Drop per-provider files left over from earlier runs whose provider did
  // not succeed this run, so the directory never advertises data that the
  // freshly-written index omits.
  const pruned = [];
  for (const entry of io.readdirSync(outputDir)) {
    if (!entry.endsWith('.json') || entry === indexFileName) continue;
    const providerId = entry.slice(0, -'.json'.length);
    if (!writtenIds.has(providerId)) {
      io.unlinkSync(`${outputDir}/${entry}`);
      pruned.push(providerId);
    }
  }

  const index = buildIndex(results);
  const indexPath = `${outputDir}/${indexFileName}`;
  writeFileAtomic(io, indexPath, JSON.stringify(index, null, 2));
  files.push(indexPath);

  return { files, index, pruned };
}

/**
 * Write via a temp file + rename in the destination directory so readers
 * never observe a partially-written JSON document (crash-safe swap).
 */
function writeFileAtomic(io, filePath, contents) {
  const tmpPath = `${filePath}.tmp`;
  io.writeFileSync(tmpPath, contents, 'utf8');
  io.renameSync(tmpPath, filePath);
}

module.exports = {
  collectProvider,
  collectAllProviders,
  buildIndex,
  writeProviderOutputs,
};
