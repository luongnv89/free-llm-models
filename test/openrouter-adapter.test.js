const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { createRegistry, validateProviderAdapter } = require('../lib/providers/registry');
const {
  validateCanonicalModel,
  openRouterModelToCanonical,
} = require('../lib/providers/schema');
const {
  createOpenRouterAdapter,
  isFreePricing,
} = require('../lib/providers/openrouter');

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'openrouter-models.json');
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

function makeAdapter(overrides = {}) {
  return createOpenRouterAdapter({
    apiKey: 'test-key',
    baseUrl: 'https://openrouter.example',
    fetchImpl: async () => {
      throw new Error('network not expected in tests');
    },
    ...overrides,
  });
}

test('openrouter adapter satisfies the ProviderAdapter contract', () => {
  const adapter = makeAdapter();
  assert.doesNotThrow(() => validateProviderAdapter(adapter));
  assert.strictEqual(adapter.id, 'openrouter');
  assert.strictEqual(adapter.metadata.id, 'openrouter');

  const registry = createRegistry();
  registry.registerProvider(adapter);
  assert.strictEqual(registry.getProvider('openrouter'), adapter);
});

test('adapter.isFree matches the legacy strict string-equality predicate', () => {
  const adapter = makeAdapter();

  for (const model of fixture.data) {
    assert.strictEqual(
      adapter.isFree(model),
      isFreePricing(model.pricing),
      `isFree mismatch for ${model.id}`
    );
  }

  assert.strictEqual(adapter.isFree({}), false);
  assert.strictEqual(adapter.isFree({ pricing: undefined }), false);
  assert.strictEqual(isFreePricing(), false);
  assert.strictEqual(isFreePricing({ prompt: '-0', completion: '0' }), false);
});

test('fixture filter selects exactly the free models', () => {
  const adapter = makeAdapter();
  const freeIds = fixture.data.filter((m) => adapter.isFree(m)).map((m) => m.id);
  assert.deepStrictEqual(freeIds, [
    'openai/gpt-oss-120b:free',
    'meta-llama/llama-3.3-70b-instruct:free',
  ]);
});

test('normalize produces valid canonical models without mutating raw input', () => {
  const adapter = makeAdapter();
  const raw = fixture.data[0];
  const snapshot = JSON.parse(JSON.stringify(raw));

  const canonical = adapter.normalize(raw);

  assert.deepStrictEqual(raw, snapshot, 'raw entry must not be mutated');
  assert.notStrictEqual(canonical, raw);
  assert.deepStrictEqual(canonical, raw, 'canonical shape equals raw shape');
  assert.deepStrictEqual(validateCanonicalModel(canonical), {
    valid: false,
    errors: ['providerId must be a non-empty string'],
  });
  assert.deepStrictEqual(
    validateCanonicalModel(openRouterModelToCanonical(canonical)),
    { valid: true, errors: [] }
  );
});

// ── Old-vs-new pipeline equivalence ─────────────────────────────────────────
function legacyPipeline(data) {
  const isFreePricingLegacy = (pricing = {}) =>
    pricing.prompt === '0' && pricing.completion === '0';
  return data.filter((m) => isFreePricingLegacy(m.pricing));
}

function adapterPipeline(data, adapter) {
  return data.filter((m) => adapter.isFree(m)).map((m) => adapter.normalize(m));
}

test('old and new normalization paths produce identical updater output', () => {
  const { mergeFreeListHistory } = require('../lib/free-models-history');
  const { attachPopularity } = require('../lib/free-models-popularity');

  const previous = {
    fetchedAt: '2026-08-01T00:00:00.000Z',
    models: [{ id: 'gone/model:free' }],
    archivedModels: [],
  };
  const fetchedAt = '2026-08-25T12:00:00.000Z';
  const topWeekly = fixture.data;

  function buildOutput(freeModels) {
    const { models, archivedModels, newModelIds } = mergeFreeListHistory(
      previous,
      freeModels,
      fetchedAt
    );
    const modelsWithPopularity = attachPopularity({
      models,
      rankingsDaily: null,
      topWeekly,
      asOf: fetchedAt,
      hasApiKey: false,
    });
    return {
      totalModels: modelsWithPopularity.length,
      newModelIds,
      models: modelsWithPopularity,
      archivedModels,
    };
  }

  const legacyOutput = buildOutput(legacyPipeline(fixture.data));
  const adapterOutput = buildOutput(
    adapterPipeline(fixture.data, makeAdapter())
  );

  assert.deepStrictEqual(adapterOutput, legacyOutput);
  assert.strictEqual(legacyOutput.totalModels, 2);
  assert.deepStrictEqual(legacyOutput.newModelIds, [
    'openai/gpt-oss-120b:free',
    'meta-llama/llama-3.3-70b-instruct:free',
  ]);
});

// ── HTTP behaviour with injected fetch ──────────────────────────────────────
test('fetchModels hits the models endpoint with auth header when keyed', async () => {
  const calls = [];
  const adapter = makeAdapter({
    fetchImpl: async (url, init) => {
      calls.push({ url, headers: init.headers });
      return {
        ok: true,
        json: async () => ({ data: fixture.data }),
      };
    },
  });

  const models = await adapter.fetchModels();

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, 'https://openrouter.example/api/v1/models');
  assert.strictEqual(calls[0].headers.Authorization, 'Bearer test-key');
  assert.strictEqual(models.length, 3);
});

test('fetchModels omits Authorization without an API key', async () => {
  let seenHeaders;
  const adapter = makeAdapter({
    apiKey: '',
    fetchImpl: async (url, init) => {
      seenHeaders = init.headers;
      return { ok: true, json: async () => ({ data: [] }) };
    },
  });

  await adapter.fetchModels();

  assert.strictEqual(seenHeaders.Authorization, undefined);
  assert.strictEqual(seenHeaders.Accept, 'application/json');
  assert.strictEqual(seenHeaders['User-Agent'], 'openrouter-free-models-updater');
});

test('fetchModels throws on non-OK responses', async () => {
  const adapter = makeAdapter({
    fetchImpl: async () => ({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    }),
  });

  await assert.rejects(() => adapter.fetchModels(), /HTTP 429: rate limited/);
});

test('hasApiKey mirrors the rankings-daily gating predicate', () => {
  assert.strictEqual(makeAdapter({ apiKey: '' }).hasApiKey(), false);
  assert.strictEqual(makeAdapter({ apiKey: '   ' }).hasApiKey(), false);
  assert.strictEqual(makeAdapter({ apiKey: 'sk-or-test' }).hasApiKey(), true);
});
