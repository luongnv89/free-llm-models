const { defineProviderMetadata } = require('./schema');

/**
 * A provider adapter bridges a remote model catalog and the CanonicalModel
 * schema. Adapters are plain objects matching this contract:
 *
 * @typedef {Object} ProviderAdapter
 * @property {string} id Unique provider identifier (e.g. 'openrouter').
 * @property {string} name Human-readable provider name.
 * @property {Object} metadata Provider metadata as returned by
 *   `defineProviderMetadata` (see lib/providers/schema.js).
 * @property {() => Promise<Object[]>} fetchModels Fetch the raw model list
 *   from the provider. Must not be called at module load time.
 * @property {(raw: Object) => boolean} isFree Decide whether a raw model
 *   entry qualifies as free.
 * @property {(raw: Object) => Object} normalize Map a raw model entry to a
 *   CanonicalModel (validated by validateCanonicalModel).
 */

/**
 * Validate that an object satisfies the ProviderAdapter contract shape.
 * Throws a TypeError listing every violation when it does not.
 *
 * @param {ProviderAdapter} adapter
 * @returns {ProviderAdapter} The adapter, for chaining convenience.
 */
function validateProviderAdapter(adapter) {
  const errors = [];

  if (typeof adapter !== 'object' || adapter === null || Array.isArray(adapter)) {
    throw new TypeError('provider adapter must be a plain object');
  }
  if (typeof adapter.id !== 'string' || adapter.id.length === 0) {
    errors.push('id must be a non-empty string');
  }
  if (typeof adapter.name !== 'string' || adapter.name.length === 0) {
    errors.push('name must be a non-empty string');
  }
  if (typeof adapter.metadata !== 'object' || adapter.metadata === null || Array.isArray(adapter.metadata)) {
    errors.push('metadata must be an object');
  } else if (
    typeof adapter.metadata.id === 'string' &&
    adapter.id.length > 0 &&
    adapter.metadata.id !== adapter.id
  ) {
    errors.push('metadata.id must match the adapter id');
  }
  if (typeof adapter.fetchModels !== 'function') {
    errors.push('fetchModels must be a function');
  }
  if (typeof adapter.isFree !== 'function') {
    errors.push('isFree must be a function');
  }
  if (typeof adapter.normalize !== 'function') {
    errors.push('normalize must be a function');
  }

  if (errors.length > 0) {
    throw new TypeError(`invalid provider adapter: ${errors.join('; ')}`);
  }
  return adapter;
}

/**
 * Create a fresh, empty provider registry.
 *
 * @returns {{ registerProvider: (adapter: ProviderAdapter) => ProviderAdapter,
 *             getProviders: () => ProviderAdapter[],
 *             getProvider: (id: string) => ProviderAdapter | undefined }}
 */
function createRegistry() {
  const providers = new Map();

  return {
    /**
     * Register a provider adapter. Validates the contract shape and rejects
     * duplicate ids by throwing.
     *
     * @param {ProviderAdapter} adapter
     * @returns {ProviderAdapter} The registered adapter.
     */
    registerProvider(adapter) {
      validateProviderAdapter(adapter);

      if (providers.has(adapter.id)) {
        throw new Error(`provider already registered with id "${adapter.id}"`);
      }

      providers.set(adapter.id, adapter);
      return adapter;
    },

    /**
     * List all registered providers in registration order.
     *
     * @returns {ProviderAdapter[]}
     */
    getProviders() {
      return [...providers.values()];
    },

    /**
     * Look up a registered provider by its id.
     *
     * @param {string} id
     * @returns {ProviderAdapter | undefined}
     */
    getProvider(id) {
      return providers.get(id);
    },
  };
}

module.exports = {
  createRegistry,
  validateProviderAdapter,
};
