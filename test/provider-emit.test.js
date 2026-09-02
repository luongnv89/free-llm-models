const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  collectProvider,
  collectAllProviders,
  buildIndex,
  writeProviderOutputs,
} = require('../lib/providers/emit');

const UPDATER = require('../get_openrouter_free_models');

const FIXTURES = path.join(__dirname, 'fixtures');
const groqFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'groq-models.json'), 'utf8'));
const googleFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'google-models.json'), 'utf8'));

function fakeAdapter(id, overrides = {}) {
  const rawModels = overrides.rawModels ?? [];
  return {
    id,
    name: overrides.name ?? id,
    metadata: { id, displayName: overrides.name ?? id, baseUrl: null, apiKeySignupUrl: null, docsUrl: null, notes: null },
    allowKeylessFetch: overrides.allowKeylessFetch,
    hasApiKey: () => overrides.hasApiKey ?? true,
    fetchModels: overrides.fetchModels ?? (async () => rawModels),
    isFree: () => true,
    normalize: (m) => ({ ...m, providerId: id }),
  };
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'emit-test-'));
}

test('collectProvider returns ok result with normalized models and fetchedAt', async () => {
  const adapter = fakeAdapter('groq', { rawModels: groqFixture.data });
  const result = await collectProvider(adapter, { now: () => '2026-08-25T00:00:00.000Z' });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.providerId, 'groq');
  assert.strictEqual(result.fetchedAt, '2026-08-25T00:00:00.000Z');
  assert.ok(Array.isArray(result.models));
  assert.ok(result.models.length > 0);
  for (const m of result.models) assert.strictEqual(m.providerId, 'groq');
});

test('collectProvider skips a provider without an API key unless keyless fetch is allowed', async () => {
  const noKey = fakeAdapter('google', { hasApiKey: false });
  const noKeyResult = await collectProvider(noKey);
  assert.deepStrictEqual(noKeyResult, {
    ok: false,
    providerId: 'google',
    reason: 'missing-api-key',
  });

  const keyless = fakeAdapter('openrouter', { hasApiKey: false, allowKeylessFetch: true });
  const keylessResult = await collectProvider(keyless);
  assert.strictEqual(keylessResult.ok, true);
});

test('collectProvider reports a failed provider without breaking others', async () => {
  const failing = fakeAdapter('failing', {
    fetchModels: async () => {
      throw new Error('HTTP 500: boom');
    },
  });
  const working = fakeAdapter('working', { rawModels: [{ id: 'm1' }] });

  const failed = await collectProvider(failing);
  assert.strictEqual(failed.ok, false);
  assert.strictEqual(failed.reason, 'fetch-failed');
  assert.match(failed.error, /HTTP 500/);

  const ok = await collectProvider(working);
  assert.strictEqual(ok.ok, true);
});

test('collectAllProviders splits results and skipped', async () => {
  const adapters = [
    fakeAdapter('a', { rawModels: [{ id: 'a1' }] }),
    fakeAdapter('b', { hasApiKey: false }),
    fakeAdapter('c', {
      fetchModels: async () => {
        throw new Error('nope');
      },
    }),
  ];
  const { results, skipped } = await collectAllProviders(adapters);
  assert.deepStrictEqual(results.map((r) => r.providerId), ['a']);
  assert.deepStrictEqual(skipped.map((s) => s.providerId), ['b', 'c']);
});

test('buildIndex lists providers with counts and flattens all models', () => {
  const results = [
    {
      providerId: 'groq',
      name: 'Groq',
      metadata: { id: 'groq', displayName: 'Groq' },
      fetchedAt: '2026-08-25T01:00:00.000Z',
      models: [{ id: 'g1', providerId: 'groq' }, { id: 'g2', providerId: 'groq' }],
    },
    {
      providerId: 'google',
      name: 'Google AI Studio',
      metadata: { id: 'google', displayName: 'Google AI Studio' },
      fetchedAt: '2026-08-25T01:00:01.000Z',
      models: [{ id: 'gem-1', providerId: 'google' }],
    },
  ];

  const index = buildIndex(results);
  assert.deepStrictEqual(index.providers, [
    {
      id: 'groq',
      name: 'Groq',
      metadata: { id: 'groq', displayName: 'Groq' },
      modelCount: 2,
      fetchedAt: '2026-08-25T01:00:00.000Z',
    },
    {
      id: 'google',
      name: 'Google AI Studio',
      metadata: { id: 'google', displayName: 'Google AI Studio' },
      modelCount: 1,
      fetchedAt: '2026-08-25T01:00:01.000Z',
    },
  ]);
  assert.deepStrictEqual(
    index.models.map((m) => `${m.providerId}:${m.id}`),
    ['groq:g1', 'groq:g2', 'google:gem-1']
  );
});

test('writeProviderOutputs emits per-provider files plus a merged index', () => {
  const dir = tmpDir();
  try {
    const results = [
      {
        providerId: 'groq',
        name: 'Groq',
        metadata: groqAdapterMetadata(),
        fetchedAt: '2026-08-25T02:00:00.000Z',
        models: [{ id: 'g1', providerId: 'groq' }],
      },
      {
        providerId: 'google',
        name: 'Google AI Studio',
        metadata: { id: 'google', displayName: 'Google AI Studio' },
        fetchedAt: '2026-08-25T02:00:00.000Z',
        models: [{ id: 'gem-1', providerId: 'google' }],
      },
    ];

    const outputDir = path.join(dir, 'nested', 'models');
    const { files, index } = writeProviderOutputs({ results, outputDir });

    assert.strictEqual(files.length, 3);

    const groqFile = JSON.parse(fs.readFileSync(path.join(outputDir, 'groq.json'), 'utf8'));
    assert.deepStrictEqual(groqFile, {
      providerId: 'groq',
      fetchedAt: '2026-08-25T02:00:00.000Z',
      models: [{ id: 'g1', providerId: 'groq' }],
    });

    const googleFile = JSON.parse(fs.readFileSync(path.join(outputDir, 'google.json'), 'utf8'));
    assert.strictEqual(googleFile.providerId, 'google');
    assert.strictEqual(googleFile.models.length, 1);

    const indexOnDisk = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'index.json'), 'utf8')
    );
    assert.deepStrictEqual(indexOnDisk, index);
    assert.strictEqual(index.providers.length, 2);
    assert.strictEqual(index.models.length, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function groqAdapterMetadata() {
  return { id: 'groq', displayName: 'Groq' };
}

test('writeProviderOutputs prunes stale provider files from earlier runs', () => {
  const dir = tmpDir();
  try {
    fs.writeFileSync(
      path.join(dir, 'ghost.json'),
      JSON.stringify({ providerId: 'ghost', stale: true }),
      'utf8'
    );

    const results = [
      {
        providerId: 'groq',
        name: 'Groq',
        metadata: groqAdapterMetadata(),
        fetchedAt: '2026-08-25T02:00:00.000Z',
        models: [{ id: 'g1', providerId: 'groq' }],
      },
    ];
    const { files, pruned } = writeProviderOutputs({ results, outputDir: dir });

    assert.deepStrictEqual(pruned, ['ghost']);
    assert.ok(!fs.existsSync(path.join(dir, 'ghost.json')));
    assert.ok(fs.existsSync(path.join(dir, 'groq.json')));
    assert.strictEqual(files.filter((f) => f.endsWith('.json')).length, files.length);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('legacy OpenRouter snapshot format is preserved (backward compat)', async () => {
  const dir = tmpDir();
  try {
    const legacyPath = path.join(dir, 'openrouter_free_models.json');
    const fetchedAt = '2026-08-25T03:00:00.000Z';

    // Seed a previous snapshot so the history merge is exercised.
    fs.writeFileSync(
      legacyPath,
      JSON.stringify({
        fetchedAt: '2026-08-24T03:00:00.000Z',
        totalModels: 1,
        newModelIds: [],
        models: [
          {
            id: 'gone-model',
            name: 'Gone',
            addedToFreeList: '2026-08-20T00:00:00.000Z',
          },
          {
            id: 'kept-model',
            name: 'Kept',
            addedToFreeList: '2026-08-24T03:00:00.000Z',
          },
        ],
        archivedModels: [],
      }),
      'utf8'
    );

    const adapter = {
      id: 'openrouter',
      name: 'OpenRouter',
      hasApiKey: () => false,
      fetchRankingsDaily: async () => {
        throw new Error('not used without a key');
      },
      fetchTopWeekly: async () => [{ id: 'kept-model' }],
    };
    const freeModels = [
      {
        id: 'kept-model',
        name: 'Kept',
        created: 1,
        description: '',
        context_length: null,
        pricing: { prompt: '0', completion: '0' },
        architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] },
        addedToFreeList: '2026-08-24T03:00:00.000Z',
      },
      {
        id: 'brand-new',
        name: 'New',
        created: 2,
        description: '',
        context_length: null,
        pricing: { prompt: '0', completion: '0' },
        architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] },
      },
    ];

    const written = await UPDATER.writeLegacyOpenRouterSnapshot({
      adapter,
      freeModels,
      fetchedAt,
      outputPath: legacyPath,
    });
    assert.strictEqual(written, legacyPath);

    const doc = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
    // Legacy envelope keys must be exactly as before.
    assert.deepStrictEqual(Object.keys(doc), [
      'fetchedAt',
      'totalModels',
      'newModelIds',
      'models',
      'archivedModels',
    ]);
    assert.strictEqual(doc.fetchedAt, fetchedAt);
    assert.strictEqual(doc.totalModels, 2);
    assert.deepStrictEqual(doc.newModelIds, ['brand-new']);
    assert.ok(Array.isArray(doc.models) && doc.models.length === 2);

    // The removed model was archived with the legacy archive entry shape.
    assert.strictEqual(doc.archivedModels.length, 1);
    const archived = doc.archivedModels[0];
    assert.deepStrictEqual(Object.keys(archived), [
      'id',
      'providerId',
      'removedAt',
      'lastSeenAt',
      'addedToFreeList',
      'model',
    ]);
    assert.strictEqual(archived.id, 'gone-model');
    assert.strictEqual(archived.providerId, 'openrouter');

    // History merge preserved addedToFreeList for surviving models.
    const kept = doc.models.find((m) => m.id === 'kept-model');
    assert.strictEqual(kept.addedToFreeList, '2026-08-24T03:00:00.000Z');
    const fresh = doc.models.find((m) => m.id === 'brand-new');
    assert.strictEqual(fresh.addedToFreeList, fetchedAt);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('openrouter adapter is registered first and permits keyless fetch', () => {
  const ids = UPDATER.registry.getProviders().map((a) => a.id);
  assert.deepStrictEqual(ids, [
    'openrouter',
    'groq',
    'cerebras',
    'google',
    'mistral',
    'github-models',
    'huggingface',
    'nvidia-nim',
    'amd-tokenfactory',
  ]);
  const openrouter = UPDATER.registry.getProvider('openrouter');
  assert.strictEqual(openrouter.allowKeylessFetch, true);
});
