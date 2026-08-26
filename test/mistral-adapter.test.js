const { test } = require('node:test');
const assert = require('node:assert');

const { createRegistry } = require('../lib/providers/registry');
const {
  validateCanonicalModel,
} = require('../lib/providers/schema');
const {
  createMistralAdapter,
  isMistralFree,
} = require('../lib/providers/mistral');
const {
  loadFixtureModels,
  runAdapterContract,
  assertCanonicalModelValid,
} = require('./helpers/adapter-harness');

const fixturePayload = loadFixtureModels('mistral-models.json');
const fixtureModels = fixturePayload.data;
const MODELS_URL = 'https://mistral.example/v1/models';

function makeAdapter(overrides = {}) {
  return createMistralAdapter({
    apiKey: 'test-key',
    baseUrl: 'https://mistral.example/v1',
    fetchImpl: async () => {
      throw new Error('network not expected in tests');
    },
    ...overrides,
  });
}

runAdapterContract({
  adapterName: 'mistral',
  createAdapter: (overrides) => makeAdapter(overrides),
  fixtureModels,
  modelsUrl: MODELS_URL,
});

test('mistral adapter satisfies the ProviderAdapter contract', () => {
  const adapter = makeAdapter();
  assert.strictEqual(adapter.id, 'mistral');
  assert.strictEqual(adapter.name, 'Mistral AI');
  assert.strictEqual(adapter.metadata.id, 'mistral');
  assert.strictEqual(adapter.metadata.displayName, 'Mistral AI');
  assert.strictEqual(
    adapter.metadata.baseUrl,
    'https://mistral.example/v1'
  );
  assert.strictEqual(
    adapter.metadata.apiKeySignupUrl,
    'https://console.mistral.ai'
  );
  assert.strictEqual(adapter.metadata.docsUrl, 'https://docs.mistral.ai');

  const registry = createRegistry();
  registry.registerProvider(adapter);
  assert.strictEqual(registry.getProvider('mistral'), adapter);
});

test('metadata carries the free-tier rate-limit caveat in notes', () => {
  const adapter = makeAdapter();
  assert.ok(
    /rate limit/i.test(adapter.metadata.notes),
    'notes must mention the rate-limit caveat'
  );
});

test('isMistralFree treats any catalog entry with an id as free-tier-listable', () => {
  for (const model of fixtureModels) {
    assert.strictEqual(isMistralFree(model), true);
  }

  assert.strictEqual(isMistralFree({}), false);
  assert.strictEqual(isMistralFree({ id: '' }), false);
  assert.strictEqual(isMistralFree({ id: 42 }), false);
  assert.strictEqual(isMistralFree(undefined), false);

  const adapter = makeAdapter();
  assert.strictEqual(adapter.isFree({ id: 'x' }), true);
  assert.strictEqual(adapter.isFree({}), false);
});

test('normalize emits providerId mistral with valid context/modality fields', () => {
  const adapter = makeAdapter();
  const raw = fixtureModels[0];
  const snapshot = JSON.parse(JSON.stringify(raw));

  const canonical = adapter.normalize(raw);

  assert.deepStrictEqual(raw, snapshot, 'raw entry must not be mutated');
  assert.notStrictEqual(canonical, raw);
  assert.strictEqual(canonical.providerId, 'mistral');
  assert.strictEqual(canonical.id, raw.id);
  assert.strictEqual(canonical.context_length, raw.max_context_length);
  assert.strictEqual(canonical.architecture.modality, 'text->text');
  assert.deepStrictEqual(canonical.architecture.input_modalities, ['text']);
  assert.deepStrictEqual(canonical.architecture.output_modalities, ['text']);
  assert.deepStrictEqual(validateCanonicalModel(canonical), {
    valid: true,
    errors: [],
  });
});

test('normalize derives name from id and leaves description empty', () => {
  const adapter = makeAdapter();

  assert.strictEqual(
    adapter.normalize({ id: 'mistral-small-latest' }).name,
    'Mistral Small Latest'
  );
  assert.strictEqual(
    adapter.normalize({ id: 'codestral-latest' }).name,
    'Codestral Latest'
  );
  assert.strictEqual(adapter.normalize({ id: 'x' }).description, '');
});

test('normalize falls back to null context_length when max_context_length is missing', () => {
  const adapter = makeAdapter();
  const raw = { ...fixtureModels[0] };
  delete raw.max_context_length;
  const canonical = adapter.normalize(raw);

  assert.strictEqual(canonical.context_length, null);
  assertCanonicalModelValid(canonical, 'missing-max_context_length');
});

test('normalize tolerates a missing capabilities object', () => {
  const adapter = makeAdapter();
  const raw = { ...fixtureModels[0] };
  delete raw.capabilities;

  const canonical = adapter.normalize(raw);

  assert.strictEqual(canonical.id, raw.id);
  assert.strictEqual(canonical.context_length, raw.max_context_length);
  assertCanonicalModelValid(canonical, 'missing-capabilities');
});

test('normalize reports flat zero pricing without inventing per-token rates', () => {
  const adapter = makeAdapter();
  const canonical = adapter.normalize(fixtureModels[0]);

  assert.deepStrictEqual(canonical.pricing, { prompt: '0', completion: '0' });
});

test('normalize throws on non-object input', () => {
  const adapter = makeAdapter();
  assert.throws(() => adapter.normalize(null), TypeError);
  assert.throws(() => adapter.normalize('nope'), TypeError);
  assert.throws(() => adapter.normalize([fixtureModels[0]]), TypeError);
});

test('fetchModels hits the models endpoint with auth header when keyed', async () => {
  const calls = [];
  const adapter = makeAdapter({
    fetchImpl: async (url, init) => {
      calls.push({ url, headers: init.headers });
      return {
        ok: true,
        json: async () => ({ object: 'list', data: fixtureModels }),
      };
    },
  });

  const models = await adapter.fetchModels();

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, 'https://mistral.example/v1/models');
  assert.strictEqual(calls[0].headers.Authorization, 'Bearer test-key');
  assert.strictEqual(models.length, fixtureModels.length);
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

test('hasApiKey mirrors key presence', () => {
  assert.strictEqual(makeAdapter({ apiKey: '' }).hasApiKey(), false);
  assert.strictEqual(makeAdapter({ apiKey: '   ' }).hasApiKey(), false);
  assert.strictEqual(makeAdapter({ apiKey: 'sk_test' }).hasApiKey(), true);
});
