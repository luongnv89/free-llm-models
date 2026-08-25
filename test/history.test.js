const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  loadPreviousSnapshot,
  mergeFreeListHistory,
} = require('../get_openrouter_free_models.js');

function makeModel(id, extra = {}) {
  return {
    id,
    name: id,
    canonical_slug: id.replace(/:free$/, ''),
    created: 1700000000,
    ...extra,
  };
}

test('loadPreviousSnapshot returns null when the file is missing', () => {
  const missing = path.join(os.tmpdir(), `no-such-snapshot-${Date.now()}.json`);
  assert.strictEqual(loadPreviousSnapshot(missing), null);
});

test('loadPreviousSnapshot reads a valid previous snapshot', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hist-'));
  const file = path.join(dir, 'openrouter_free_models.json');
  const snapshot = {
    fetchedAt: '2026-01-01T00:00:00.000Z',
    models: [makeModel('acme/a')],
    archivedModels: [],
  };
  fs.writeFileSync(file, JSON.stringify(snapshot));
  assert.deepStrictEqual(loadPreviousSnapshot(file), snapshot);
});

test('corrupt previous JSON fails closed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hist-'));
  const file = path.join(dir, 'openrouter_free_models.json');
  fs.writeFileSync(file, '{not-json');
  assert.throws(() => loadPreviousSnapshot(file), /corrupt/);
});

test('previous snapshot with a non-array models field fails closed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hist-'));
  const file = path.join(dir, 'openrouter_free_models.json');
  fs.writeFileSync(file, JSON.stringify({ models: { id: 'x' } }));
  assert.throws(() => loadPreviousSnapshot(file), /corrupt/);
});

test('previous snapshot with a non-array archivedModels field fails closed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hist-'));
  const file = path.join(dir, 'openrouter_free_models.json');
  fs.writeFileSync(file, JSON.stringify({ models: [], archivedModels: {} }));
  assert.throws(() => loadPreviousSnapshot(file), /corrupt/);
});

test('first run stamps every current model with fetchedAt', () => {
  const fetchedAt = '2026-08-25T00:00:00.000Z';
  const current = [makeModel('acme/a'), makeModel('acme/b')];
  const result = mergeFreeListHistory(null, current, fetchedAt);
  assert.deepStrictEqual(
    result.models.map((m) => m.addedToFreeList),
    [fetchedAt, fetchedAt]
  );
  assert.deepStrictEqual(result.archivedModels, []);
  assert.deepStrictEqual(result.newModelIds, ['acme/a', 'acme/b']);
});

test('preserves existing addedToFreeList on subsequent runs', () => {
  const original = '2026-01-15T12:00:00.000Z';
  const previous = {
    fetchedAt: '2026-08-24T00:00:00.000Z',
    models: [makeModel('acme/a', { addedToFreeList: original })],
  };
  const current = [makeModel('acme/a', { name: 'A renamed' })];
  const result = mergeFreeListHistory(previous, current, '2026-08-25T00:00:00.000Z');
  assert.strictEqual(result.models[0].addedToFreeList, original);
  assert.strictEqual(result.models[0].name, 'A renamed');
  assert.deepStrictEqual(result.newModelIds, []);
  assert.deepStrictEqual(result.archivedModels, []);
});

test('archives models that leave the free list', () => {
  const added = '2026-02-01T00:00:00.000Z';
  const previous = {
    fetchedAt: '2026-08-24T00:00:00.000Z',
    models: [
      makeModel('acme/stay', { addedToFreeList: added }),
      makeModel('acme/leave', { addedToFreeList: added, description: 'gone' }),
    ],
    archivedModels: [],
  };
  const fetchedAt = '2026-08-25T00:00:00.000Z';
  const result = mergeFreeListHistory(previous, [makeModel('acme/stay')], fetchedAt);

  assert.deepStrictEqual(
    result.models.map((m) => m.id),
    ['acme/stay']
  );
  assert.strictEqual(result.archivedModels.length, 1);
  const archived = result.archivedModels[0];
  assert.strictEqual(archived.id, 'acme/leave');
  assert.strictEqual(archived.removedAt, fetchedAt);
  assert.strictEqual(archived.lastSeenAt, previous.fetchedAt);
  assert.strictEqual(archived.addedToFreeList, added);
  assert.strictEqual(archived.model.description, 'gone');
});

test('a returning model keeps its original join date and leaves the archive', () => {
  const original = '2026-03-01T00:00:00.000Z';
  const previous = {
    fetchedAt: '2026-08-24T00:00:00.000Z',
    models: [makeModel('acme/live', { addedToFreeList: '2026-04-01T00:00:00.000Z' })],
    archivedModels: [
      {
        id: 'acme/back',
        removedAt: '2026-07-01T00:00:00.000Z',
        lastSeenAt: '2026-06-30T00:00:00.000Z',
        addedToFreeList: original,
        model: makeModel('acme/back', { addedToFreeList: original }),
      },
    ],
  };
  const fetchedAt = '2026-08-25T00:00:00.000Z';
  const result = mergeFreeListHistory(
    previous,
    [makeModel('acme/live'), makeModel('acme/back')],
    fetchedAt
  );

  const returned = result.models.find((m) => m.id === 'acme/back');
  assert.ok(returned);
  assert.strictEqual(returned.addedToFreeList, original);
  assert.deepStrictEqual(
    result.archivedModels.map((a) => a.id),
    []
  );
  assert.deepStrictEqual(result.newModelIds, ['acme/back']);
});

test('keeps previously archived models that stay off the free list', () => {
  const previous = {
    fetchedAt: '2026-08-24T00:00:00.000Z',
    models: [makeModel('acme/live', { addedToFreeList: '2026-01-01T00:00:00.000Z' })],
    archivedModels: [
      {
        id: 'acme/old',
        removedAt: '2026-05-01T00:00:00.000Z',
        lastSeenAt: '2026-04-30T00:00:00.000Z',
        addedToFreeList: '2026-01-02T00:00:00.000Z',
        model: makeModel('acme/old'),
      },
    ],
  };
  const result = mergeFreeListHistory(
    previous,
    [makeModel('acme/live')],
    '2026-08-25T00:00:00.000Z'
  );
  assert.strictEqual(result.archivedModels.length, 1);
  assert.strictEqual(result.archivedModels[0].id, 'acme/old');
  assert.strictEqual(result.archivedModels[0].removedAt, '2026-05-01T00:00:00.000Z');
});

test('first-seen models without prior history use fetchedAt', () => {
  const previous = {
    fetchedAt: '2026-08-24T00:00:00.000Z',
    models: [makeModel('acme/old', { addedToFreeList: '2026-01-01T00:00:00.000Z' })],
  };
  const fetchedAt = '2026-08-25T00:00:00.000Z';
  const result = mergeFreeListHistory(
    previous,
    [makeModel('acme/old'), makeModel('acme/new')],
    fetchedAt
  );
  const fresh = result.models.find((m) => m.id === 'acme/new');
  assert.strictEqual(fresh.addedToFreeList, fetchedAt);
  assert.deepStrictEqual(result.newModelIds, ['acme/new']);
});

const {
  DEFAULT_PROVIDER_ID,
  historyEntryKey,
} = require('../lib/free-models-history');
const { attachPopularity } = require('../lib/free-models-popularity');

test('history keys are composite and legacy entries default to openrouter', () => {
  assert.strictEqual(DEFAULT_PROVIDER_ID, 'openrouter');
  assert.notStrictEqual(
    historyEntryKey('groq', 'm1'),
    historyEntryKey('google', 'm1')
  );
});

test('legacy-format entries (no providerId) are treated as openrouter', () => {
  const original = '2026-01-15T12:00:00.000Z';
  const previous = {
    fetchedAt: '2026-08-24T00:00:00.000Z',
    models: [makeModel('legacy/m1', { addedToFreeList: original })],
    archivedModels: [],
  };
  const fetchedAt = '2026-08-25T00:00:00.000Z';

  const openrouterResult = mergeFreeListHistory(previous, [makeModel('legacy/m1')], fetchedAt);
  assert.strictEqual(openrouterResult.models[0].addedToFreeList, original);
  assert.deepStrictEqual(openrouterResult.newModelIds, []);

  // Another provider must not see the legacy OpenRouter entry.
  const googleResult = mergeFreeListHistory(
    previous,
    [makeModel('legacy/m1')],
    fetchedAt,
    { providerId: 'google' }
  );
  assert.strictEqual(googleResult.models[0].addedToFreeList, fetchedAt);
  assert.deepStrictEqual(googleResult.newModelIds, ['legacy/m1']);
  assert.deepStrictEqual(googleResult.archivedModels, []);
});

test('same model id on two providers stays distinct', () => {
  const groqAdded = '2026-02-01T00:00:00.000Z';
  const orAdded = '2026-03-01T00:00:00.000Z';
  const previous = {
    fetchedAt: '2026-08-24T00:00:00.000Z',
    models: [
      { ...makeModel('dup/model', { addedToFreeList: groqAdded }), providerId: 'groq' },
      makeModel('dup/model', { addedToFreeList: orAdded }),
    ],
  };
  const fetchedAt = '2026-08-25T00:00:00.000Z';

  const result = mergeFreeListHistory(previous, [makeModel('dup/model')], fetchedAt);
  assert.strictEqual(result.models[0].addedToFreeList, orAdded);
  assert.deepStrictEqual(result.newModelIds, []);
  assert.deepStrictEqual(result.archivedModels, []);
});

test('newly archived entries carry the slice providerId', () => {
  const previous = {
    fetchedAt: '2026-08-24T00:00:00.000Z',
    models: [{ ...makeModel('gone/m1'), providerId: 'groq' }],
  };
  const result = mergeFreeListHistory(previous, [], '2026-08-25T00:00:00.000Z', {
    providerId: 'groq',
  });
  assert.strictEqual(result.archivedModels.length, 1);
  assert.strictEqual(result.archivedModels[0].providerId, 'groq');
});

test('legacy archive entries rejoin under openrouter but not other providers', () => {
  const original = '2026-03-01T00:00:00.000Z';
  const previous = {
    fetchedAt: '2026-08-24T00:00:00.000Z',
    models: [],
    archivedModels: [
      {
        id: 'acme/back',
        removedAt: '2026-07-01T00:00:00.000Z',
        lastSeenAt: '2026-06-30T00:00:00.000Z',
        addedToFreeList: original,
        model: makeModel('acme/back'),
      },
    ],
  };
  const fetchedAt = '2026-08-25T00:00:00.000Z';

  const openrouterResult = mergeFreeListHistory(previous, [makeModel('acme/back')], fetchedAt);
  assert.strictEqual(openrouterResult.models[0].addedToFreeList, original);
  assert.deepStrictEqual(openrouterResult.archivedModels, []);

  const groqResult = mergeFreeListHistory(
    previous,
    [makeModel('acme/back')],
    fetchedAt,
    { providerId: 'groq' }
  );
  assert.strictEqual(groqResult.models[0].addedToFreeList, fetchedAt);
  assert.deepStrictEqual(groqResult.archivedModels, []);
});

test('popularity attaches independently to provider-keyed merged models', () => {
  const previous = null;
  const groqAt = '2026-08-24T00:00:00.000Z';
  const googleAt = '2026-08-25T00:00:00.000Z';
  const groqSlice = mergeFreeListHistory(
    previous,
    [{ ...makeModel('shared/model'), providerId: 'groq' }],
    groqAt,
    { providerId: 'groq' }
  );
  const googleSlice = mergeFreeListHistory(
    previous,
    [{ ...makeModel('shared/model'), providerId: 'google' }],
    googleAt,
    { providerId: 'google' }
  );

  const merged = [...groqSlice.models, ...googleSlice.models];
  assert.strictEqual(merged.length, 2);

  const withPopularity = attachPopularity({
    models: merged,
    topWeekly: [{ id: 'shared/model' }],
    asOf: googleAt,
  });

  // Rows stay distinct despite identical ids...
  assert.deepStrictEqual(withPopularity.map((m) => m.providerId), ['groq', 'google']);
  // ...keep their independently-merged history stamps...
  assert.notStrictEqual(
    withPopularity[0].addedToFreeList,
    withPopularity[1].addedToFreeList
  );
  // ...and each gets its own popularity attachment.
  assert.deepStrictEqual(
    withPopularity.map((m) => [m.popularity.source, m.popularity.rank]),
    [['top-weekly', 1], ['top-weekly', 1]]
  );
});
