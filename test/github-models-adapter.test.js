const { test } = require('node:test');
const assert = require('node:assert');

const { createRegistry } = require('../lib/providers/registry');
const {
  validateCanonicalModel,
} = require('../lib/providers/schema');
const {
  createGitHubModelsAdapter,
  isGitHubModelsFree,
} = require('../lib/providers/github-models');
const {
  loadFixtureModels,
  assertCanonicalModelValid,
  runAdapterContract,
} = require('./helpers/adapter-harness');

// The GitHub Models catalog endpoint returns a bare JSON array.
const fixtureModels = loadFixtureModels('github-models.json');

function makeAdapter(overrides = {}) {
  return createGitHubModelsAdapter({
    apiKey: 'ghp_test-token',
    baseUrl: 'https://models.github.example',
    fetchImpl: async () => {
      throw new Error('network not expected in tests');
    },
    ...overrides,
  });
}

runAdapterContract({
  adapterName: 'github-models',
  createAdapter: (overrides = {}) =>
    makeAdapter({ apiKey: '', ...overrides }),
  fixtureModels,
  modelsUrl: 'https://models.github.example/catalog/models',
  wrapResponse: (models) => models,
});

test('github-models adapter satisfies the ProviderAdapter contract', () => {
  const adapter = makeAdapter();
  assert.strictEqual(adapter.id, 'github-models');
  assert.strictEqual(adapter.metadata.id, 'github-models');
  assert.strictEqual(adapter.metadata.displayName, 'GitHub Models');
  assert.strictEqual(adapter.metadata.baseUrl, 'https://models.github.example');
  assert.strictEqual(
    adapter.metadata.apiKeySignupUrl,
    'https://github.com/settings/tokens'
  );
  assert.strictEqual(
    adapter.metadata.docsUrl,
    'https://docs.github.com/en/github-models'
  );

  const registry = createRegistry();
  registry.registerProvider(adapter);
  assert.strictEqual(registry.getProvider('github-models'), adapter);
});

test('isGitHubModelsFree treats every identified catalog entry as free-tier-listable', () => {
  for (const model of fixtureModels) {
    assert.strictEqual(isGitHubModelsFree(model), true);
  }

  assert.strictEqual(isGitHubModelsFree({}), false);
  assert.strictEqual(isGitHubModelsFree({ id: '' }), false);
  assert.strictEqual(isGitHubModelsFree({ id: 42 }), false);
  assert.strictEqual(isGitHubModelsFree(undefined), false);

  const adapter = makeAdapter();
  assert.strictEqual(adapter.isFree({ id: 'x' }), true);
  assert.strictEqual(adapter.isFree({}), false);
});

test('normalize emits providerId github-models with valid context/modality fields', () => {
  const adapter = makeAdapter();
  const raw = fixtureModels[0];
  const snapshot = JSON.parse(JSON.stringify(raw));

  const canonical = adapter.normalize(raw);

  assert.deepStrictEqual(raw, snapshot, 'raw entry must not be mutated');
  assert.notStrictEqual(canonical, raw);
  assert.strictEqual(canonical.providerId, 'github-models');
  assert.strictEqual(canonical.id, raw.id);
  assert.strictEqual(canonical.context_length, raw.context_window);
  assert.strictEqual(canonical.architecture.modality, 'text+image->text');
  assert.deepStrictEqual(canonical.architecture.input_modalities, [
    'text',
    'image',
  ]);
  assert.deepStrictEqual(canonical.architecture.output_modalities, ['text']);
  assert.deepStrictEqual(validateCanonicalModel(canonical), {
    valid: true,
    errors: [],
  });
});

test('normalize honors catalog name/summary and derives a fallback name', () => {
  const adapter = makeAdapter();

  const named = adapter.normalize(fixtureModels[0]);
  assert.strictEqual(named.name, 'OpenAI GPT-4o mini');
  assert.strictEqual(named.description, fixtureModels[0].summary);

  const derived = adapter.normalize({
    id: 'meta/Llama-3.3-70B-Instruct',
  });
  assert.strictEqual(derived.name, 'Meta/Llama 3 3 70B Instruct');
  assert.strictEqual(derived.description, '');
});

test('normalize falls back to text modality and null context when missing', () => {
  const adapter = makeAdapter();
  const canonical = adapter.normalize({ id: 'some/model', created: 1 });

  assert.strictEqual(canonical.context_length, null);
  assert.strictEqual(canonical.architecture.modality, 'text->text');
  assertCanonicalModelValid(canonical, 'missing-context_window');
});

test('normalize tolerates empty or malformed modality arrays', () => {
  const adapter = makeAdapter();

  const empty = adapter.normalize({
    id: 'a/b',
    supported_input_modalities: [],
    supported_output_modalities: [7, null],
  });
  assert.deepStrictEqual(empty.architecture.input_modalities, ['text']);
  assert.deepStrictEqual(empty.architecture.output_modalities, ['text']);
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

test('fetchModels hits the catalog endpoint with auth header when keyed', async () => {
  const calls = [];
  const adapter = makeAdapter({
    fetchImpl: async (url, init) => {
      calls.push({ url, headers: init.headers });
      return {
        ok: true,
        json: async () => fixtureModels,
      };
    },
  });

  const models = await adapter.fetchModels();

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(
    calls[0].url,
    'https://models.github.example/catalog/models'
  );
  assert.strictEqual(calls[0].headers.Authorization, 'Bearer ghp_test-token');
  assert.strictEqual(models.length, fixtureModels.length);
});

test('fetchModels unwraps an OpenAI-style data envelope when present', async () => {
  const adapter = makeAdapter({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ data: fixtureModels }),
    }),
  });

  const models = await adapter.fetchModels();
  assert.deepStrictEqual(models, fixtureModels);
});

test('fetchModels throws a descriptive error on an unexpected envelope', async () => {
  for (const payload of [{}, { body: fixtureModels }, null, 'nope']) {
    const adapter = makeAdapter({
      fetchImpl: async () => ({ ok: true, json: async () => payload }),
    });
    await assert.rejects(
      () => adapter.fetchModels(),
      /unexpected catalog response shape/
    );
  }
});

test('fetchModels omits Authorization without a token', async () => {
  let seenHeaders;
  const adapter = makeAdapter({
    apiKey: '',
    fetchImpl: async (url, init) => {
      seenHeaders = init.headers;
      return { ok: true, json: async () => [] };
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
      text: async () => 'Bad credentials',
    }),
  });

  await assert.rejects(() => adapter.fetchModels(), /HTTP 401: Bad credentials/);
});

test('hasApiKey mirrors token presence', () => {
  assert.strictEqual(makeAdapter({ apiKey: '' }).hasApiKey(), false);
  assert.strictEqual(makeAdapter({ apiKey: '   ' }).hasApiKey(), false);
  assert.strictEqual(makeAdapter({ apiKey: 'ghp_x' }).hasApiKey(), true);
});
