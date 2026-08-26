const { test } = require('node:test');
const assert = require('node:assert');

const { createRegistry } = require('../lib/providers/registry');
const {
  validateCanonicalModel,
} = require('../lib/providers/schema');
const {
  createCerebrasAdapter,
  isCerebrasFree,
} = require('../lib/providers/cerebras');
const {
  loadFixtureModels,
  runAdapterContract,
  assertCanonicalModelValid,
} = require('./helpers/adapter-harness');

const fixturePayload = loadFixtureModels('cerebras-models.json');
const fixtureModels = fixturePayload.data;
const MODELS_URL = 'https://cerebras.example/v1/models';

function makeAdapter(overrides = {}) {
  return createCerebrasAdapter({
    apiKey: 'test-key',
    baseUrl: 'https://cerebras.example/v1',
    fetchImpl: async () => {
      throw new Error('network not expected in tests');
    },
    ...overrides,
  });
}

runAdapterContract({
  adapterName: 'cerebras',
  createAdapter: (overrides) => makeAdapter(overrides),
  fixtureModels,
  modelsUrl: MODELS_URL,
});

test('cerebras adapter satisfies the ProviderAdapter contract', () => {
  const adapter = makeAdapter();
  assert.strictEqual(adapter.id, 'cerebras');
  assert.strictEqual(adapter.name, 'Cerebras');
  assert.strictEqual(adapter.metadata.id, 'cerebras');
  assert.strictEqual(adapter.metadata.displayName, 'Cerebras');
  assert.strictEqual(
    adapter.metadata.apiKeySignupUrl,
    'https://cloud.cerebras.ai'
  );
  assert.strictEqual(
    adapter.metadata.docsUrl,
    'https://inference-docs.cerebras.ai'
  );

  const registry = createRegistry();
  registry.registerProvider(adapter);
  assert.strictEqual(registry.getProvider('cerebras'), adapter);
});

test('isCerebrasFree treats any catalog entry with an id as free-tier-listable', () => {
  for (const model of fixtureModels) {
    assert.strictEqual(isCerebrasFree(model), true);
  }

  assert.strictEqual(isCerebrasFree({}), false);
  assert.strictEqual(isCerebrasFree({ id: '' }), false);
  assert.strictEqual(isCerebrasFree({ id: 42 }), false);
  assert.strictEqual(isCerebrasFree(undefined), false);

  const adapter = makeAdapter();
  assert.strictEqual(adapter.isFree({ id: 'x' }), true);
  assert.strictEqual(adapter.isFree({}), false);
});

test('normalize emits providerId cerebras with valid context/modality fields', () => {
  const adapter = makeAdapter();
  const raw = fixtureModels[0];
  const snapshot = JSON.parse(JSON.stringify(raw));

  const canonical = adapter.normalize(raw);

  assert.deepStrictEqual(raw, snapshot, 'raw entry must not be mutated');
  assert.notStrictEqual(canonical, raw);
  assert.strictEqual(canonical.providerId, 'cerebras');
  assert.strictEqual(canonical.id, raw.id);
  assert.strictEqual(canonical.context_length, raw.context_window);
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
    adapter.normalize({ id: 'llama3.1-8b' }).name,
    'Llama3 1 8b'
  );
  assert.strictEqual(
    adapter.normalize({ id: 'qwen-3-32b' }).name,
    'Qwen 3 32b'
  );
  assert.strictEqual(adapter.normalize({ id: 'x' }).description, '');
});

test('normalize falls back to null context_length when missing', () => {
  const adapter = makeAdapter();
  const canonical = adapter.normalize({ id: 'some-model', created: 1 });

  assert.strictEqual(canonical.context_length, null);
  assertCanonicalModelValid(canonical, 'missing-context_window');
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
  assert.strictEqual(calls[0].url, 'https://cerebras.example/v1/models');
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
  assert.strictEqual(makeAdapter({ apiKey: 'csk_test' }).hasApiKey(), true);
});
