const { runAdapterContract, loadFixtureModels } = require('./helpers/adapter-harness');

const {
  createOpenRouterAdapter,
} = require('../lib/providers/openrouter');
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
