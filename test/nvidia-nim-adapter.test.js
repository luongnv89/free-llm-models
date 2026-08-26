const { test } = require('node:test');
const assert = require('node:assert');

const { createRegistry } = require('../lib/providers/registry');
const {
  validateCanonicalModel,
} = require('../lib/providers/schema');
const {
  createNvidiaNimAdapter,
  isNvidiaNimFree,
} = require('../lib/providers/nvidia-nim');
const {
  loadFixtureModels,
  runAdapterContract,
  assertCanonicalModelValid,
} = require('./helpers/adapter-harness');

const fixturePayload = loadFixtureModels('nvidia-nim-models.json');
const fixtureModels = fixturePayload.data;
const MODELS_URL = 'https://integrate.api.nvidia.com/v1/models';

function makeAdapter(overrides = {}) {
  return createNvidiaNimAdapter({
    apiKey: 'nvapi_test-key',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    fetchImpl: async () => {
      throw new Error('network not expected in tests');
    },
    ...overrides,
  });
}

runAdapterContract({
  adapterName: 'nvidia-nim',
  createAdapter: (overrides) => makeAdapter(overrides),
  fixtureModels,
  modelsUrl: MODELS_URL,
});

test('nvidia-nim adapter satisfies the ProviderAdapter contract', () => {
  const adapter = makeAdapter();
  assert.strictEqual(adapter.id, 'nvidia-nim');
  assert.strictEqual(adapter.name, 'NVIDIA NIM');
  assert.strictEqual(adapter.metadata.id, 'nvidia-nim');
  assert.strictEqual(adapter.metadata.displayName, 'NVIDIA NIM');
  assert.strictEqual(adapter.metadata.apiKeySignupUrl, 'https://build.nvidia.com');
  assert.strictEqual(adapter.metadata.docsUrl, 'https://docs.api.nvidia.com');

  const registry = createRegistry();
  registry.registerProvider(adapter);
  assert.strictEqual(registry.getProvider('nvidia-nim'), adapter);
});

test('metadata labels access as trial-credit rather than permanent free', () => {
  const adapter = makeAdapter();
  assert.match(adapter.metadata.notes, /trial credits/i);
  assert.match(adapter.metadata.notes, /not permanently free|not\s+permanently free|trial-credit/);
});

test('isNvidiaNimFree treats any catalog entry with an id as trial-credit eligible', () => {
  for (const model of fixtureModels) {
    assert.strictEqual(isNvidiaNimFree(model), true);
  }

  assert.strictEqual(isNvidiaNimFree({}), false);
  assert.strictEqual(isNvidiaNimFree({ id: '' }), false);
  assert.strictEqual(isNvidiaNimFree({ id: 42 }), false);
  assert.strictEqual(isNvidiaNimFree(undefined), false);

  const adapter = makeAdapter();
  assert.strictEqual(adapter.isFree({ id: 'x' }), true);
  assert.strictEqual(adapter.isFree({}), false);
});

test('normalize emits providerId nvidia-nim with valid context/modality fields', () => {
  const adapter = makeAdapter();
  const raw = fixtureModels[0];
  const snapshot = JSON.parse(JSON.stringify(raw));

  const canonical = adapter.normalize(raw);

  assert.deepStrictEqual(raw, snapshot, 'raw entry must not be mutated');
  assert.notStrictEqual(canonical, raw);
  assert.strictEqual(canonical.providerId, 'nvidia-nim');
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
    adapter.normalize({ id: 'meta/llama-3.3-70b-instruct' }).name,
    'Meta/llama 3 3 70b Instruct'
  );
  assert.strictEqual(
    adapter.normalize({ id: 'deepseek-ai/deepseek-r1' }).name,
    'Deepseek Ai/deepseek R1'
  );
  assert.strictEqual(adapter.normalize({ id: 'x' }).description, '');
});

test('normalize falls back to null context_length when missing', () => {
  const adapter = makeAdapter();
  const canonical = adapter.normalize({ id: 'some-model', created: 1 });

  assert.strictEqual(canonical.context_length, null);
  assertCanonicalModelValid(canonical, 'missing-context_length');
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
  assert.strictEqual(calls[0].url, 'https://integrate.api.nvidia.com/v1/models');
  assert.strictEqual(calls[0].headers.Authorization, 'Bearer nvapi_test-key');
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
      status: 401,
      text: async () => 'unauthorized',
    }),
  });

  await assert.rejects(() => adapter.fetchModels(), /HTTP 401: unauthorized/);
});

test('hasApiKey mirrors key presence and reads NVIDIA_API_KEY by default', async () => {
  assert.strictEqual(makeAdapter({ apiKey: '' }).hasApiKey(), false);
  assert.strictEqual(makeAdapter({ apiKey: '   ' }).hasApiKey(), false);
  assert.strictEqual(makeAdapter({ apiKey: 'nvapi_x' }).hasApiKey(), true);

  const previous = process.env.NVIDIA_API_KEY;
  process.env.NVIDIA_API_KEY = 'nvapi_env-key';
  try {
    const envAdapter = createNvidiaNimAdapter();
    assert.strictEqual(envAdapter.hasApiKey(), true);
  } finally {
    if (previous === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = previous;
  }
});
