'use strict';

const fs = require('fs');

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

function mergeFreeListHistory(previous, currentFreeModels, fetchedAt) {
  const prevModels = Array.isArray(previous?.models) ? previous.models : [];
  const prevArchive = Array.isArray(previous?.archivedModels) ? previous.archivedModels : [];
  const prevById = new Map(prevModels.map((m) => [m.id, m]));
  const archiveById = new Map(prevArchive.map((a) => [a.id, a]));
  const currentIds = new Set(currentFreeModels.map((m) => m.id));

  const models = currentFreeModels.map((model) => {
    const prev = prevById.get(model.id);
    const archived = archiveById.get(model.id);
    const addedToFreeList =
      addedToFreeListFrom(prev) || addedToFreeListFrom(archived) || fetchedAt;
    return { ...model, addedToFreeList };
  });

  const archivedModels = [];
  const archivedIds = new Set();

  for (const prev of prevModels) {
    if (currentIds.has(prev.id) || archivedIds.has(prev.id)) continue;
    archivedIds.add(prev.id);
    archivedModels.push({
      id: prev.id,
      removedAt: fetchedAt,
      lastSeenAt: previous?.fetchedAt || fetchedAt,
      addedToFreeList: addedToFreeListFrom(prev),
      model: prev,
    });
  }

  for (const archived of prevArchive) {
    if (currentIds.has(archived.id) || archivedIds.has(archived.id)) continue;
    archivedIds.add(archived.id);
    archivedModels.push(archived);
  }

  const previousLiveIds = new Set(prevModels.map((m) => m.id));
  const newModelIds = currentFreeModels
    .filter((m) => !previousLiveIds.has(m.id))
    .map((m) => m.id);

  return { models, archivedModels, newModelIds };
}

module.exports = {
  loadPreviousSnapshot,
  mergeFreeListHistory,
};
