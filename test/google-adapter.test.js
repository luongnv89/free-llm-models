const { test } = require('node:test');
const assert = require('node:assert');

const { createRegistry } = require('../lib/providers/registry');
const {
  validateCanonicalModel,
} = require('../lib/providers/schema');
const {
  createGoogleAdapter,
  isGoogleFree,
} = require('../lib/providers/google');
const {
  loadFixtureModels,
  runAdapterContract,
  assertCanonicalModelValid,
} = require('./helpers/adapter-harness');

const fixturePayload = loadFixtureModels('google-models.json');
const fixtureModels = fixturePayload.models;
const MODELS_URL = 'https://google.example/v1beta/models';

function makeAdapter(overrides = {}) {
  return createGoogleAdapter({
    apiKey: 'test-key',
    baseUrl: 'https://google.example/v1beta',
    fetchImpl: async () => {
      throw new Error('network not expected in tests');
    },
    ...overrides,
  });
}

runAdapterContract({
  adapterName: 'google',
  createAdapter: (overrides) => makeAdapter(overrides),
  fixtureModels,
  modelsUrl: MODELS_URL,
  wrapResponse: (models) => ({ models }),
  requiredRawField: 'name',
});

test('google adapter satisfies the ProviderAdapter contract', () => {
  const adapter = makeAdapter();
  assert.strictEqual(adapter.id, 'google');
  assert.strictEqual(adapter.name, 'Google AI Studio');
  assert.strictEqual(adapter.metadata.id, 'google');
  assert.strictEqual(
    adapter.metadata.displayName,
    'Google AI Studio'
  );
  assert.strictEqual(adapter.metadata.baseUrl, 'https://google.example/v1beta');
  assert.strictEqual(
    adapter.metadata.apiKeySignupUrl,
    'https://aistudio.google.com/apikey'
  );
  assert.strictEqual(
    adapter.metadata.docsUrl,
    'https://ai.google.dev/gemini-api/docs'
  );

  const registry = createRegistry();
  registry.registerProvider(adapter);
  assert.strictEqual(registry.getProvider('google'), adapter);
});

test('isGoogleFree selects models supporting generateContent', () => {
  for (const model of fixtureModels) {
    const methods = Array.isArray(model.supportedGenerationMethods)
      ? model.supportedGenerationMethods
      : [];
    assert.strictEqual(isGoogleFree(model), methods.includes('generateContent'));
  }

  assert.strictEqual(isGoogleFree({}), false);
  assert.strictEqual(isGoogleFree(undefined), false);
  // Non-array supportedGenerationMethods must never qualify as free.
  assert.strictEqual(
    isGoogleFree({ supportedGenerationMethods: 'generateContent' }),
    false
  );
  assert.strictEqual(isGoogleFree({ supportedGenerationMethods: null }), false);

  const adapter = makeAdapter();
  assert.strictEqual(
    adapter.isFree({ name: 'models/gemini-2.5-flash' }),
    false
  );
  assert.strictEqual(
    adapter.isFree({
      name: 'models/gemini-2.5-flash',
      supportedGenerationMethods: ['generateContent'],
    }),
    true
  );
});

test('normalize strips the models/ prefix and uses displayName', () => {
  const adapter = makeAdapter();

  assert.strictEqual(
    adapter.normalize({ name: 'models/gemini-2.5-flash' }).id,
    'gemini-2.5-flash'
  );
  // Names without the prefix pass through unchanged.
  assert.strictEqual(adapter.normalize({ name: 'gemma-3' }).id, 'gemma-3');
  // Only the leading prefix is stripped; nested slashes survive.
  assert.strictEqual(
    adapter.normalize({ name: 'models/tuned/gemini' }).id,
    'tuned/gemini'
  );

  const canonical = adapter.normalize({
    name: 'models/gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
  });
  assert.strictEqual(canonical.name, 'Gemini 2.5 Flash');
});

test('normalize falls back to the derived id when displayName is missing', () => {
  const adapter = makeAdapter();
  assert.strictEqual(
    adapter.normalize({ name: 'models/gemini-2.5-flash' }).name,
    'gemini-2.5-flash'
  );
  assert.strictEqual(adapter.normalize({}).name, '');
});

test('normalize maps inputTokenLimit and keeps description', () => {
  const adapter = makeAdapter();
  const raw = fixtureModels[0];
  const snapshot = JSON.parse(JSON.stringify(raw));

  const canonical = adapter.normalize(raw);

  assert.deepStrictEqual(raw, snapshot, 'raw entry must not be mutated');
  assert.notStrictEqual(canonical, raw);
  assert.strictEqual(canonical.context_length, raw.inputTokenLimit);
  assert.strictEqual(canonical.description, raw.description);
  assert.deepStrictEqual(validateCanonicalModel(canonical), {
    valid: true,
    errors: [],
  });
});

test('normalize falls back to null context_length when missing', () => {
  const adapter = makeAdapter();
  const canonical = adapter.normalize({
    name: 'models/some-model',
    supportedGenerationMethods: ['generateContent'],
  });

  assert.strictEqual(canonical.context_length, null);
  assertCanonicalModelValid(canonical, 'missing-inputTokenLimit');
});

test('normalize reports flat zero pricing without inventing per-token rates', () => {
  const adapter = makeAdapter();
  const canonical = adapter.normalize(fixtureModels[0]);

  assert.deepStrictEqual(canonical.pricing, { prompt: '0', completion: '0' });
});

test('normalize emits providerId google with text modality', () => {
  const adapter = makeAdapter();
  const canonical = adapter.normalize(fixtureModels[0]);

  assert.strictEqual(canonical.providerId, 'google');
  assert.strictEqual(canonical.architecture.modality, 'text->text');
  assert.deepStrictEqual(canonical.architecture.input_modalities, ['text']);
  assert.deepStrictEqual(canonical.architecture.output_modalities, ['text']);
});

test('normalize is idempotent and accepts canonical-shaped input', () => {
  const adapter = makeAdapter();
  const once = adapter.normalize(fixtureModels[0]);
  const twice = adapter.normalize(once);

  assert.deepStrictEqual(twice, once, 'normalize must be idempotent');
  assert.strictEqual(twice.id, 'gemini-2.5-flash');
  assert.strictEqual(twice.name, 'Gemini 2.5 Flash');
  assertCanonicalModelValid(twice, 'double-normalized');

  // Canonical entries carry id instead of name; both must map identically.
  const fromId = adapter.normalize({ id: 'gemini-2.5-flash', context_length: 99 });
  assert.strictEqual(fromId.id, 'gemini-2.5-flash');
  assert.strictEqual(fromId.context_length, 99);
});

test('normalize throws on non-object input', () => {
  const adapter = makeAdapter();
  assert.throws(() => adapter.normalize(null), TypeError);
  assert.throws(() => adapter.normalize('nope'), TypeError);
  assert.throws(() => adapter.normalize([fixtureModels[0]]), TypeError);
});

test('fetchModels hits the models endpoint with the key query param', async () => {
  const calls = [];
  const adapter = makeAdapter({
    fetchImpl: async (url, init) => {
      calls.push({ url, headers: init.headers });
      return {
        ok: true,
        json: async () => ({ models: fixtureModels }),
      };
    },
  });

  const models = await adapter.fetchModels();

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(
    calls[0].url,
    'https://google.example/v1beta/models?key=test-key'
  );
  assert.strictEqual(models.length, fixtureModels.length);
});

test('fetchModels omits the key query param without an API key', async () => {
  let seenUrl;
  const adapter = makeAdapter({
    apiKey: '',
    fetchImpl: async (url) => {
      seenUrl = url;
      return { ok: true, json: async () => ({ models: [] }) };
    },
  });

  await adapter.fetchModels();

  assert.strictEqual(seenUrl, 'https://google.example/v1beta/models');
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
  assert.strictEqual(makeAdapter({ apiKey: 'AIza_test' }).hasApiKey(), true);
});
