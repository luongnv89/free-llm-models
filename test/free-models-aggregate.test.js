const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildAggregate,
  writeFreeModelsAggregate,
} = require('../lib/providers/emit');
const { createRegistry } = require('../lib/providers/registry');
const { runUpdate, freeModelsAggregatePath } = require('../lib/providers/run-update');

function makeResult(providerId, overrides = {}) {
  return {
    providerId,
    name: overrides.name ?? providerId,
    metadata: { id: providerId, displayName: overrides.name ?? providerId },
    fetchedAt: overrides.fetchedAt,
    models: overrides.models ?? [],
    ...(overrides.history ? { history: overrides.history } : {}),
  };
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aggregate-test-'));
}

test('buildAggregate produces the ModelsData shape with latest fetchedAt', () => {
  const results = [
    makeResult('groq', {
      fetchedAt: '2026-08-25T02:00:00.000Z',
      models: [{ id: 'g1', providerId: 'groq' }, { id: 'g2', providerId: 'groq' }],
      history: { newModelIds: ['g2'], archivedModels: [] },
    }),
    makeResult('google', {
      name: 'Google AI Studio',
      fetchedAt: '2026-08-25T05:00:00.000Z',
      models: [{ id: 'gem-1', providerId: 'google' }],
      history: { newModelIds: ['gem-1'], archivedModels: [] },
    }),
  ];

  const data = buildAggregate(results);
  assert.deepStrictEqual(Object.keys(data), [
    'fetchedAt',
    'totalModels',
    'newModelIds',
    'models',
    'archivedModels',
    'providers',
  ]);
  assert.strictEqual(data.fetchedAt, '2026-08-25T05:00:00.000Z');
  assert.strictEqual(data.totalModels, 3);
  assert.deepStrictEqual(data.newModelIds.sort(), ['g2', 'gem-1']);
  assert.deepStrictEqual(
    data.models.map((m) => `${m.providerId}:${m.id}`).sort(),
    ['google:gem-1', 'groq:g1', 'groq:g2']
  );
  assert.deepStrictEqual(
    data.providers.map((p) => p.id),
    ['groq', 'google']
  );
});

test('buildAggregate flattens archived models across providers retaining providerId', () => {
  const results = [
    makeResult('alpha', {
      fetchedAt: '2026-08-25T00:00:00.000Z',
      models: [],
      history: {
        newModelIds: [],
        archivedModels: [
          { id: 'gone-a', providerId: 'alpha', removedAt: 't1', model: { id: 'gone-a' } },
        ],
      },
    }),
    makeResult('beta', {
      fetchedAt: '2026-08-25T01:00:00.000Z',
      models: [{ id: 'b1', providerId: 'beta' }],
      history: {
        newModelIds: ['b1'],
        archivedModels: [
          { id: 'gone-b', removedAt: 't2', model: { id: 'gone-b' } },
        ],
      },
    }),
  ];

  const data = buildAggregate(results);
  assert.deepStrictEqual(data.newModelIds, ['b1']);
  assert.strictEqual(data.archivedModels.length, 2);
  const alphaArchive = data.archivedModels.find((a) => a.id === 'gone-a');
  assert.strictEqual(alphaArchive.providerId, 'alpha');
  // Missing providerId is backfilled from the owning result.
  const betaArchive = data.archivedModels.find((a) => a.id === 'gone-b');
  assert.strictEqual(betaArchive.providerId, 'beta');
});

test('buildAggregate handles results without history merges', () => {
  const data = buildAggregate([
    makeResult('solo', {
      fetchedAt: '2026-08-25T00:00:00.000Z',
      models: [{ id: 's1', providerId: 'solo' }],
    }),
  ]);
  assert.strictEqual(data.totalModels, 1);
  assert.deepStrictEqual(data.newModelIds, []);
  assert.deepStrictEqual(data.archivedModels, []);
});

test('writeFreeModelsAggregate writes atomically (temp + rename)', () => {
  const dir = tmpDir();
  try {
    const outputPath = path.join(dir, 'nested', 'free_models.json');
    const calls = [];
    const io = new Proxy(fs, {
      get(target, prop) {
        if (['mkdirSync', 'writeFileSync', 'renameSync'].includes(prop)) {
          return (...args) => {
            calls.push(prop);
            return target[prop](...args);
          };
        }
        return target[prop];
      },
    });

    const results = [
      makeResult('groq', {
        fetchedAt: '2026-08-25T00:00:00.000Z',
        models: [{ id: 'g1', providerId: 'groq' }],
      }),
    ];
    const { path: writtenPath, data } = writeFreeModelsAggregate({
      results,
      outputPath,
      io,
    });

    assert.strictEqual(writtenPath, outputPath);
    assert.deepStrictEqual(calls.sort(), ['mkdirSync', 'renameSync', 'writeFileSync']);
    assert.ok(!fs.existsSync(`${outputPath}.tmp`), 'temp file was renamed away');

    const onDisk = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    assert.deepStrictEqual(onDisk, data);
    assert.strictEqual(onDisk.totalModels, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function fakeAdapter(id, overrides = {}) {
  return {
    id,
    name: id,
    metadata: { id, displayName: id },
    allowKeylessFetch: true,
    hasApiKey: () => true,
    fetchModels: async () => overrides.rawModels ?? [],
    isFree: () => true,
    normalize: (m) => ({ ...m, providerId: id }),
    ...(overrides.openrouterExtras ?? {}),
  };
}

test('runUpdate writes free_models.json after per-provider history merges', async () => {
  const dir = tmpDir();
  try {
    const outputDir = path.join(dir, 'models');
    const aggregateOutputPath = path.join(dir, 'free_models.json');

    // Seed a previous slice so the history merge archives a dropped model.
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(
      path.join(outputDir, 'groq.json'),
      JSON.stringify({
        providerId: 'groq',
        fetchedAt: '2026-08-24T00:00:00.000Z',
        newModelIds: [],
        archivedModels: [],
        models: [
          { id: 'gone', name: 'Gone', providerId: 'groq', addedToFreeList: '2026-08-24T00:00:00.000Z' },
          { id: 'kept', name: 'Kept', providerId: 'groq', addedToFreeList: '2026-08-24T00:00:00.000Z' },
        ],
      })
    );

    const registry = createRegistry();
    registry.registerProvider(fakeAdapter('groq', { rawModels: [{ id: 'kept' }, { id: 'fresh' }] }));
    registry.registerProvider(fakeAdapter('google', { rawModels: [{ id: 'gem-1' }] }));

    const summary = await runUpdate({
      registry,
      outputDir,
      aggregateOutputPath,
      legacyOutputPath: path.join(dir, 'legacy.json'),
      now: () => '2026-08-25T00:00:00.000Z',
      log: () => {},
      warn: () => {},
    });

    assert.strictEqual(summary.exitCode, 0);
    assert.strictEqual(summary.aggregatePath, aggregateOutputPath);

    const data = JSON.parse(fs.readFileSync(aggregateOutputPath, 'utf8'));
    assert.strictEqual(data.fetchedAt, '2026-08-25T00:00:00.000Z');
    assert.strictEqual(data.totalModels, 3);
    // History ran before the aggregate: fresh model flagged, kept not.
    assert.deepStrictEqual(data.newModelIds.sort(), ['fresh', 'gem-1']);
    // Archived model from groq's merge carried into the aggregate with its providerId.
    assert.strictEqual(data.archivedModels.length, 1);
    assert.strictEqual(data.archivedModels[0].id, 'gone');
    assert.strictEqual(data.archivedModels[0].providerId, 'groq');
    // Every current model retains its providerId.
    for (const m of data.models) {
      assert.ok(['groq', 'google'].includes(m.providerId));
    }
    // Providers metadata present.
    assert.deepStrictEqual(
      data.providers.map((p) => p.id).sort(),
      ['google', 'groq']
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runUpdate skips free_models.json when zero providers succeed', async () => {
  const dir = tmpDir();
  try {
    const aggregateOutputPath = path.join(dir, 'free_models.json');
    const registry = createRegistry();
    registry.registerProvider({
      id: 'broken',
      name: 'Broken',
      metadata: { id: 'broken', displayName: 'Broken' },
      allowKeylessFetch: true,
      hasApiKey: () => true,
      fetchModels: async () => {
        throw new Error('HTTP 500');
      },
      isFree: () => true,
      normalize: (m) => m,
    });

    const summary = await runUpdate({
      registry,
      outputDir: path.join(dir, 'models'),
      aggregateOutputPath,
      legacyOutputPath: path.join(dir, 'legacy.json'),
      now: () => '2026-08-25T00:00:00.000Z',
      log: () => {},
      warn: () => {},
    });

    assert.strictEqual(summary.exitCode, 1);
    assert.strictEqual(summary.aggregatePath, undefined);
    assert.ok(!fs.existsSync(aggregateOutputPath));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('freeModelsAggregatePath points at web/public/free_models.json', () => {
  assert.strictEqual(
    freeModelsAggregatePath(),
    path.join(__dirname, '..', 'web', 'public', 'free_models.json')
  );
});
