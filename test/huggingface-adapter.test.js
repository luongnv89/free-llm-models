const { test } = require('node:test');
const assert = require('node:assert');

const { createRegistry } = require('../lib/providers/registry');
const {
  validateCanonicalModel,
} = require('../lib/providers/schema');
const {
  createHuggingFaceAdapter,
  isHuggingFaceFree,
} = require('../lib/providers/huggingface');
const {
  loadFixtureModels,
  runAdapterContract,
  assertCanonicalModelValid,
} = require('./helpers/adapter-harness');

const fixturePayload = loadFixtureModels('huggingface-models.json');
const fixtureModels = fixturePayload.data;
const MODELS_URL = 'https://router.huggingface.co/v1/models';

function makeAdapter(overrides = {}) {
  return createHuggingFaceAdapter({
    apiKey: 'hf_test-token',
    baseUrl: 'https://router.huggingface.co/v1',
    fetchImpl: async () => {
      throw new Error('network not expected in tests');
    },
    ...overrides,
  });
}

runAdapterContract({
  adapterName: 'huggingface',
  createAdapter: (overrides) => makeAdapter(overrides),
  fixtureModels,
  modelsUrl: MODELS_URL,
});

test('huggingface adapter satisfies the ProviderAdapter contract', () => {
  const adapter = makeAdapter();
  assert.strictEqual(adapter.id, 'huggingface');
  assert.strictEqual(adapter.name, 'Hugging Face');
  assert.strictEqual(adapter.metadata.id, 'huggingface');
  assert.strictEqual(adapter.metadata.displayName, 'Hugging Face');
  assert.strictEqual(
    adapter.metadata.apiKeySignupUrl,
    'https://huggingface.co/settings/tokens'
  );
  assert.strictEqual(
    adapter.metadata.docsUrl,
    'https://huggingface.co/docs/inference-providers'
  );
  assert.match(adapter.metadata.notes, /credits/);

  const registry = createRegistry();
  registry.registerProvider(adapter);
  assert.strictEqual(registry.getProvider('huggingface'), adapter);
});

test('isHuggingFaceFree keys on id, honoring explicit providers.is_free flags', () => {
  for (const model of fixtureModels) {
    assert.strictEqual(isHuggingFaceFree(model), true);
  }

  assert.strictEqual(isHuggingFaceFree({}), false);
  assert.strictEqual(isHuggingFaceFree({ id: '' }), false);
  assert.strictEqual(isHuggingFaceFree({ id: 42 }), false);
  assert.strictEqual(isHuggingFaceFree(undefined), false);

  assert.strictEqual(
    isHuggingFaceFree({ id: 'm', providers: [{ is_free: true }] }),
    true
  );
  assert.strictEqual(
    isHuggingFaceFree({ id: 'm', providers: [{ is_free: false }] }),
    false
  );
  assert.strictEqual(
    isHuggingFaceFree({ id: 'm', providers: [{}, { is_free: true }] }),
    true
  );
  assert.strictEqual(isHuggingFaceFree({ id: 'm', providers: [] }), true);
  assert.strictEqual(isHuggingFaceFree({ id: 'm', providers: [null] }), true);

  const adapter = makeAdapter();
  assert.strictEqual(adapter.isFree({ id: 'x' }), true);
  assert.strictEqual(adapter.isFree({}), false);
});

test('normalize emits providerId huggingface with valid context/modality fields', () => {
  const adapter = makeAdapter();
  const raw = fixtureModels[0];
  const snapshot = JSON.parse(JSON.stringify(raw));

  const canonical = adapter.normalize(raw);

  assert.deepStrictEqual(raw, snapshot, 'raw entry must not be mutated');
  assert.notStrictEqual(canonical, raw);
  assert.strictEqual(canonical.providerId, 'huggingface');
  assert.strictEqual(canonical.id, raw.id);
  assert.strictEqual(canonical.context_length, raw.context_length);
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
    adapter.normalize({ id: 'meta-llama/Llama-3.1-8B-Instruct' }).name,
    'Meta Llama/Llama 3 1 8B Instruct'
  );
  assert.strictEqual(
    adapter.normalize({ id: 'Qwen/Qwen2.5-72B-Instruct' }).name,
    'Qwen/Qwen2 5 72B Instruct'
  );
  assert.strictEqual(adapter.normalize({ id: 'x' }).description, '');
});

test('normalize falls back to null context_length when missing', () => {
  const adapter = makeAdapter();
  const canonical = adapter.normalize({ id: 'some-model', created: 1 });

  assert.strictEqual(canonical.context_length, null);
  assertCanonicalModelValid(canonical, 'missing-context_length');
});

test('normalize derives context_length from providers entries, free first', () => {
  const adapter = makeAdapter();

  assert.strictEqual(
    adapter.normalize({
      id: 'm',
      created: 1,
      providers: [{ context_length: 8192 }, { context_length: 262144 }],
    }).context_length,
    8192
  );
  assert.strictEqual(
    adapter.normalize({
      id: 'm',
      created: 1,
      providers: [
        { is_free: false, context_length: 262144 },
        { is_free: true, context_length: 8192 },
      ],
    }).context_length,
    8192
  );
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

test('fetchModels hits the router models endpoint with auth header when keyed', async () => {
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
  assert.strictEqual(calls[0].url, 'https://router.huggingface.co/v1/models');
  assert.strictEqual(calls[0].headers.Authorization, 'Bearer hf_test-token');
  assert.strictEqual(models.length, fixtureModels.length);
});

test('fetchModels omits Authorization without a token', async () => {
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

test('hasApiKey mirrors token presence', () => {
  assert.strictEqual(makeAdapter({ apiKey: '' }).hasApiKey(), false);
  assert.strictEqual(makeAdapter({ apiKey: '   ' }).hasApiKey(), false);
  assert.strictEqual(makeAdapter({ apiKey: 'hf_x' }).hasApiKey(), true);
});
