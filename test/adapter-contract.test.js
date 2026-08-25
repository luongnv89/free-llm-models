const { runAdapterContract, loadFixtureModels } = require('./helpers/adapter-harness');

const {
  createOpenRouterAdapter,
} = require('../lib/providers/openrouter');
const {
  createGroqAdapter,
} = require('../lib/providers/groq');
const {
  createGoogleAdapter,
} = require('../lib/providers/google');
const {
  openRouterModelToCanonical,
} = require('../lib/providers/schema');

// Demonstration of the reusable adapter contract harness (#50):
// future adapters (#51, #52, #63-66) can run the same suite by swapping
// the factory and fixture file.
runAdapterContract({
  adapterName: 'openrouter',
  createAdapter: (overrides = {}) =>
    createOpenRouterAdapter({
      baseUrl: 'https://openrouter.example',
      ...overrides,
    }),
  fixtureModels: loadFixtureModels('openrouter-models.json').data,
  modelsUrl: 'https://openrouter.example/api/v1/models',
  toCanonical: (raw, adapter) =>
    openRouterModelToCanonical(adapter.normalize(raw)),
});

// Groq adapter (#51): normalization already yields a valid CanonicalModel.
runAdapterContract({
  adapterName: 'groq',
  createAdapter: (overrides = {}) =>
    createGroqAdapter({
      baseUrl: 'https://groq.example/openai/v1',
      ...overrides,
    }),
  fixtureModels: loadFixtureModels('groq-models.json').data,
  modelsUrl: 'https://groq.example/openai/v1/models',
});

// Google adapter (#52): normalization already yields a valid CanonicalModel.
// Identity lives in `name` ("models/…"), not `id`, and the catalog body is
// wrapped as `{ models: [...] }` instead of `{ data: [...] }`.
runAdapterContract({
  adapterName: 'google',
  requiredRawField: 'name',
  createAdapter: (overrides = {}) =>
    createGoogleAdapter({
      apiKey: '',
      baseUrl: 'https://google.example/v1beta',
      ...overrides,
    }),
  fixtureModels: loadFixtureModels('google-models.json').models,
  modelsUrl: 'https://google.example/v1beta/models',
  wrapResponse: (models) => ({ models }),
});
