const { test } = require('node:test');
const assert = require('node:assert');

const { createRegistry } = require('../lib/providers/registry');
const {
  validateCanonicalModel,
} = require('../lib/providers/schema');
const {
  createGroqAdapter,
  isGroqFree,
} = require('../lib/providers/groq');
const {
  loadFixtureModels,
  assertCanonicalModelValid,
} = require('./helpers/adapter-harness');

const fixtureModels = loadFixtureModels('groq-models.json').data;

function makeAdapter(overrides = {}) {
  return createGroqAdapter({
    apiKey: 'test-key',
    baseUrl: 'https://groq.example/openai/v1',
    fetchImpl: async () => {
      throw new Error('network not expected in tests');
    },
    ...overrides,
  });
}

test('groq adapter satisfies the ProviderAdapter contract', () => {
  const adapter = makeAdapter();
  assert.strictEqual(adapter.id, 'groq');
  assert.strictEqual(adapter.metadata.id, 'groq');
  assert.strictEqual(adapter.metadata.displayName, 'Groq');
  assert.strictEqual(
    adapter.metadata.apiKeySignupUrl,
    'https://console.groq.com/keys'
  );
  assert.strictEqual(adapter.metadata.docsUrl, 'https://console.groq.com/docs');

  const registry = createRegistry();
  registry.registerProvider(adapter);
  assert.strictEqual(registry.getProvider('groq'), adapter);
});

test('isGroqFree treats active models as free-tier-listable', () => {
  for (const model of fixtureModels) {
    assert.strictEqual(isGroqFree(model), model.active === true);
  }

  assert.strictEqual(isGroqFree({}), false);
  assert.strictEqual(isGroqFree({ active: false }), false);
  assert.strictEqual(isGroqFree({ active: 'true' }), false);
  assert.strictEqual(isGroqFree(undefined), false);

  const adapter = makeAdapter();
  assert.strictEqual(adapter.isFree({ id: 'x' }), false);
  assert.strictEqual(adapter.isFree({ id: 'x', active: true }), true);
});

test('normalize emits providerId groq with valid context/modality fields', () => {
  const adapter = makeAdapter();
  const raw = fixtureModels[0];
  const snapshot = JSON.parse(JSON.stringify(raw));

  const canonical = adapter.normalize(raw);

  assert.deepStrictEqual(raw, snapshot, 'raw entry must not be mutated');
  assert.notStrictEqual(canonical, raw);
  assert.strictEqual(canonical.providerId, 'groq');
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
    adapter.normalize({ id: 'llama-3.3-70b-versatile' }).name,
    'Llama 3 3 70b Versatile'
  );
  assert.strictEqual(
    adapter.normalize({ id: 'openai/gpt-oss-120b' }).name,
    'Openai/gpt Oss 120b'
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
  assert.strictEqual(calls[0].url, 'https://groq.example/openai/v1/models');
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
  assert.strictEqual(makeAdapter({ apiKey: 'gsk_test' }).hasApiKey(), true);
});
