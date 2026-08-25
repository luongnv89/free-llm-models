'use strict';

const fs = require('fs');

// History entries are keyed by (providerId, modelId). Entries written before
// multi-provider tracking carry no providerId and are treated as belonging
// to OpenRouter, the only provider the legacy snapshot ever tracked.
const DEFAULT_PROVIDER_ID = 'openrouter';

// Model ids freely contain '/', ':' and other punctuation, so the composite
// key uses a separator that cannot appear inside a JSON string value.
const KEY_SEPARATOR = '\u0000';

function historyEntryKey(providerId, modelId) {
  return `${providerId ?? DEFAULT_PROVIDER_ID}${KEY_SEPARATOR}${modelId}`;
}

function entryProviderId(entry) {
  return entry?.providerId ?? DEFAULT_PROVIDER_ID;
}

function loadPreviousSnapshot(filePath, io = fs) {
  if (!io.existsSync(filePath)) {
    return null;
  }

  let raw;
  try {
    raw = io.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read previous snapshot: ${err.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Previous snapshot is corrupt (invalid JSON): ${err.message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Previous snapshot is corrupt: root must be an object');
  }
  if (parsed.models !== undefined && !Array.isArray(parsed.models)) {
    throw new Error('Previous snapshot is corrupt: models must be an array');
  }
  if (parsed.archivedModels !== undefined && !Array.isArray(parsed.archivedModels)) {
    throw new Error('Previous snapshot is corrupt: archivedModels must be an array');
  }

  return parsed;
}

function addedToFreeListFrom(entry) {
  if (!entry || typeof entry !== 'object') return undefined;
  if (typeof entry.addedToFreeList === 'string' && entry.addedToFreeList) {
    return entry.addedToFreeList;
  }
  if (entry.model && typeof entry.model.addedToFreeList === 'string' && entry.model.addedToFreeList) {
    return entry.model.addedToFreeList;
  }
  return undefined;
}

/**
 * Merge the current free-model list against the previous snapshot, keyed by
 * (providerId, modelId) so each provider's history stays isolated.
 *
 * Only entries belonging to `providerId` participate in the merge: legacy
 * entries without a providerId count as OpenRouter (DEFAULT_PROVIDER_ID), so
 * pre-existing committed history keeps working while other providers start
 * from a clean slice. Newly created archive entries are stamped with the
 * slice's providerId.
 *
 * @param {Object | null} previous Previously persisted snapshot.
 * @param {Object[]} currentFreeModels Current free models.
 * @param {string} fetchedAt ISO timestamp of this run.
 * @param {{providerId?: string}} [options] Slice provider; defaults to the
 *   first providerId found on the current models, else OpenRouter.
 */
function mergeFreeListHistory(previous, currentFreeModels, fetchedAt, { providerId } = {}) {
  const sliceProviderId =
    providerId ??
    currentFreeModels.find((m) => m?.providerId)?.providerId ??
    DEFAULT_PROVIDER_ID;

  const prevModels = Array.isArray(previous?.models) ? previous.models : [];
  const prevArchive = Array.isArray(previous?.archivedModels) ? previous.archivedModels : [];

  // Cross-provider isolation: only this slice's entries are visible.
  const slicePrev = prevModels.filter((m) => entryProviderId(m) === sliceProviderId);
  const sliceArchive = prevArchive.filter((a) => entryProviderId(a) === sliceProviderId);

  const keyFor = (entry) => historyEntryKey(sliceProviderId, entry.id);
  const prevByKey = new Map(slicePrev.map((m) => [keyFor(m), m]));
  const archiveByKey = new Map(sliceArchive.map((a) => [keyFor(a), a]));
  const currentKeys = new Set(currentFreeModels.map((m) => keyFor(m)));

  const models = currentFreeModels.map((model) => {
    const prev = prevByKey.get(keyFor(model));
    const archived = archiveByKey.get(keyFor(model));
    const addedToFreeList =
      addedToFreeListFrom(prev) || addedToFreeListFrom(archived) || fetchedAt;
    return { ...model, addedToFreeList };
  });

  const archivedModels = [];
  const archivedKeys = new Set();

  for (const prev of slicePrev) {
    const key = keyFor(prev);
    if (currentKeys.has(key) || archivedKeys.has(key)) continue;
    archivedKeys.add(key);
    archivedModels.push({
      id: prev.id,
      providerId: sliceProviderId,
      removedAt: fetchedAt,
      lastSeenAt: previous?.fetchedAt || fetchedAt,
      addedToFreeList: addedToFreeListFrom(prev),
      model: prev,
    });
  }

  for (const archived of sliceArchive) {
    const key = keyFor(archived);
    if (currentKeys.has(key) || archivedKeys.has(key)) continue;
    archivedKeys.add(key);
    archivedModels.push(archived);
  }

  const previousLiveKeys = new Set(slicePrev.map(keyFor));
  const newModelIds = currentFreeModels
    .filter((m) => !previousLiveKeys.has(keyFor(m)))
    .map((m) => m.id);

  return { models, archivedModels, newModelIds };
}

module.exports = {
  DEFAULT_PROVIDER_ID,
  historyEntryKey,
  loadPreviousSnapshot,
  mergeFreeListHistory,
};
