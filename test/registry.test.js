const { test } = require('node:test');
const assert = require('node:assert');

const { createRegistry, validateProviderAdapter } = require('../lib/providers/registry');
const { defineProviderMetadata } = require('../lib/providers/schema');

function makeAdapter(id = 'openrouter', overrides = {}) {
  return {
    id,
    name: 'OpenRouter',
    metadata: defineProviderMetadata({ id, displayName: 'OpenRouter' }),
    fetchModels: async () => [],
    isFree: () => true,
    normalize: (raw) => raw,
    ...overrides,
  };
}

test('registerProvider stores and getProvider looks up by id', () => {
  const registry = createRegistry();
  const adapter = makeAdapter();

  registry.registerProvider(adapter);

  assert.strictEqual(registry.getProvider('openrouter'), adapter);
});

test('registerProvider returns the adapter and getProviders lists in order', () => {
  const registry = createRegistry();
  const first = registry.registerProvider(makeAdapter('openrouter'));
  const second = registry.registerProvider(makeAdapter('together'));

  assert.strictEqual(first.id, 'openrouter');
  assert.strictEqual(second.id, 'together');
  assert.deepStrictEqual(registry.getProviders().map((p) => p.id), ['openrouter', 'together']);
});

test('registering two providers with duplicate ids throws', () => {
  const registry = createRegistry();
  registry.registerProvider(makeAdapter('openrouter'));

  assert.throws(
    () => registry.registerProvider(makeAdapter('openrouter')),
    /provider already registered with id "openrouter"/
  );
  assert.strictEqual(registry.getProviders().length, 1);
});

test('getProvider returns undefined for unknown ids and registries are isolated', () => {
  const registry = createRegistry();
  registry.registerProvider(makeAdapter());

  assert.strictEqual(registry.getProvider('nope'), undefined);

  const other = createRegistry();
  assert.deepStrictEqual(other.getProviders(), []);
});

test('registerProvider rejects adapters violating the contract', () => {
  const registry = createRegistry();

  for (const bad of [
    null,
    {},
    makeAdapter('a', { fetchModels: undefined }),
    makeAdapter('b', { normalize: 'nope' }),
    makeAdapter('c', { isFree: null }),
  ]) {
    if (bad && bad.id) {
      assert.throws(() => validateProviderAdapter(bad), TypeError);
      assert.throws(() => registry.registerProvider(bad), TypeError);
    } else {
      assert.throws(() => validateProviderAdapter(bad), TypeError);
    }
  }
});

test('validateProviderAdapter rejects mismatched metadata.id', () => {
  const adapter = makeAdapter('openrouter', {
    metadata: defineProviderMetadata({ id: 'other', displayName: 'Other' }),
  });
  assert.throws(() => validateProviderAdapter(adapter), /metadata\.id/);
});
