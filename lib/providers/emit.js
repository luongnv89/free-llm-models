'use strict';

const fs = require('fs');
const path = require('path');

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
 * `{ providerId, fetchedAt, newModelIds?, archivedModels?, models }`
 * (history fields present when the result carries a history merge).
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
    const payload = {
      providerId: result.providerId,
      fetchedAt: result.fetchedAt,
    };
    if (result.history) {
      payload.newModelIds = result.history.newModelIds;
      payload.archivedModels = result.history.archivedModels;
    }
    payload.models = result.models;
    writeFileAtomic(io, filePath, JSON.stringify(payload, null, 2));
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
 * Build the aggregate `free_models.json` document (frontend `ModelsData`
 * shape) from history-enriched provider results.
 *
 * Shape: `{ fetchedAt (latest), totalModels, newModelIds (flattened),
 * models (all current models), archivedModels (all archived models),
 * providers }`. `providers` is each adapter's metadata (the frontend
 * `ProviderMetadata` shape), so consumers of the aggregate never need to
 * unwrap index entries. Every model — current or archived — retains its
 * `providerId`.
 *
 * @param {{providerId: string, name: string, metadata: Object,
 *   fetchedAt: string, models: Object[], history?: {newModelIds: string[],
 *   archivedModels: Object[]}}[]} results History-enriched results.
 */
function buildAggregate(results) {
  const latestFetchedAt = results.reduce(
    (latest, r) => (Date.parse(r.fetchedAt) > Date.parse(latest) ? r.fetchedAt : latest),
    results[0]?.fetchedAt ?? ''
  );

  const providers = results.map((r) => r.metadata);

  const models = results.flatMap((r) =>
    r.models.map((m) => ({ ...m, providerId: m.providerId ?? r.providerId }))
  );

  const archivedModels = [];
  const newModelIds = [];
  for (const r of results) {
    if (!r.history) continue;
    newModelIds.push(...(r.history.newModelIds ?? []));
    archivedModels.push(
      ...(r.history.archivedModels ?? []).map((a) => ({
        ...a,
        providerId: a.providerId ?? r.providerId,
      }))
    );
  }

  return {
    fetchedAt: latestFetchedAt,
    totalModels: models.length,
    newModelIds,
    models,
    archivedModels,
    providers,
  };
}

/**
 * Write the aggregate `free_models.json` artifact for the frontend.
 *
 * @param {Object} params
 * @param {Object[]} params.results Successful collectProvider results
 *   (history-enriched).
 * @param {string} params.outputPath Destination file path.
 * @param {typeof fs} [params.io] Filesystem module (for tests).
 * @returns {{path: string, data: Object}} Written path and aggregate doc.
 */
function writeFreeModelsAggregate({ results, outputPath, io = fs }) {
  io.mkdirSync(path.dirname(outputPath), { recursive: true });
  const data = buildAggregate(results);
  writeFileAtomic(io, outputPath, JSON.stringify(data, null, 2));
  return { path: outputPath, data };
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
  buildAggregate,
  writeFreeModelsAggregate,
};
