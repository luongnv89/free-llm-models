'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const { validateProviderAdapter } = require('../../lib/providers/registry');
const { validateCanonicalModel } = require('../../lib/providers/schema');

/**
 * Fixture-based adapter contract harness.
 *
 * Reusable offline test suite for {@link ProviderAdapter} implementations
 * (see lib/providers/registry.js). Future adapters (#51, #52, #63-66)
 * should reuse this instead of hand-rolling contract checks:
 *
 * ```js
 * const { runAdapterContract } = require('./helpers/adapter-harness');
 *
 * runAdapterContract({
 *   adapterName: 'acme',
 *   createAdapter: (overrides) => createAcmeAdapter(overrides),
 *   fixtureModels: loadFixtureModels('acme-models.json'),
 *   toCanonical: (raw, adapter) => acmeToCanonical(adapter.normalize(raw)),
 * });
 * ```
 *
 * The suite never touches the network: `fetchModels` is exercised through
 * an injected `fetchImpl` that replays the checked-in fixture payload.
 */

/**
 * Read a JSON fixture from test/fixtures/.
 *
 * @param {string} filename File name inside test/fixtures/.
 * @returns {*} Parsed fixture contents.
 */
function loadFixtureModels(filename) {
  // eslint-disable-next-line import/no-dynamic-require
  return require(`../fixtures/${filename}`);
}

/**
 * Build a fetch implementation that serves recorded fixture data offline.
 * Any request to an unregistered URL throws immediately, so accidental
 * network access fails loudly.
 *
 * @param {Object} payload Payload returned as the JSON body for the
 *   models endpoint (e.g. `{ data: [...] }`).
 * @param {string[]} [allowedUrls] Exact URLs the fake fetch will answer;
 *   defaults to allowing any URL (the payload is served regardless).
 * @returns {typeof fetch} Fetch impl suitable for adapter injection.
 */
function createOfflineFetch(payload, allowedUrls = null) {
  return async (url) => {
    if (allowedUrls && !allowedUrls.includes(String(url))) {
      throw new Error(`offline fetch received unexpected URL: ${url}`);
    }
    return {
      ok: true,
      status: 200,
      json: async () => payload,
    };
  };
}

/**
 * Assert that a single canonical model conforms to the CanonicalModel
 * schema. Throws an AssertionError listing the schema errors together
 * with the offending model id — this is how the harness "fails loudly"
 * when required fields are missing.
 *
 * @param {Object} canonical Candidate CanonicalModel object.
 * @param {string} [context] Human-readable label included in failures.
 * @returns {{ valid: boolean, errors: string[] }} Validation result.
 */
function assertCanonicalModelValid(canonical, context = '') {
  const result = validateCanonicalModel(canonical);
  if (!result.valid) {
    const label = context || canonical?.id || '<unknown>';
    assert.fail(
      `canonical model "${label}" failed validation:\n  - ${result.errors.join('\n  - ')}`
    );
  }
  return result;
}

/**
 * Run the full adapter contract suite against a fixture dataset.
 * Registers node:test cases; call at module top level from a *.test.js
 * file so the runner discovers them.
 *
 * @param {Object} options
 * @param {string} options.adapterName Provider id used in test titles.
 * @param {(overrides?: Object) => Object} options.createAdapter Factory
 *   building a fresh adapter instance; overrides are merged into its
 *   constructor options so the harness can inject `fetchImpl`.
 * @param {Object[]} options.fixtureModels Recorded raw model entries.
 * @param {string} [options.modelsUrl] URL the adapter requests for its
 *   catalog; defaults to matching any URL (see createOfflineFetch).
 * @param {(raw: Object, adapter: Object) => Object} [options.toCanonical]
 *   Maps an adapter-normalized entry to a CanonicalModel. Defaults to
 *   `adapter.normalize(raw)` for adapters whose normalization already
 *   satisfies validateCanonicalModel.
 * @param {(models: Object[]) => Object} [options.wrapResponse] Wraps the
 *   raw model list into the JSON body shape the adapter parses; defaults
 *   to the OpenRouter-style `{ data: models }`.
 * @param {string} [options.requiredRawField='id'] Raw entry field whose
 *   removal must surface a CanonicalModel schema failure (providers whose
 *   identity lives elsewhere — e.g. Google's `name` — override this).
 */
function runAdapterContract({
  requiredRawField = 'id',
  adapterName,
  createAdapter,
  fixtureModels,
  modelsUrl,
  toCanonical,
  wrapResponse = (models) => ({ data: models }),
}) {
  if (typeof createAdapter !== 'function') {
    throw new TypeError('runAdapterContract requires a createAdapter factory');
  }
  if (!Array.isArray(fixtureModels) || fixtureModels.length === 0) {
    throw new TypeError(
      'runAdapterContract requires a non-empty fixtureModels: Object[]'
    );
  }

  const toCanon =
    toCanonical ||
    ((raw, adapter) => adapter.normalize(raw));

  function makeOfflineAdapter() {
    return createAdapter({
      apiKey: '',
      fetchImpl: createOfflineFetch(
        wrapResponse(fixtureModels),
        modelsUrl ? [modelsUrl] : null
      ),
    });
  }

  test(`${adapterName} adapter satisfies the ProviderAdapter contract`, () => {
    const adapter = makeOfflineAdapter();
    assert.doesNotThrow(() => validateProviderAdapter(adapter));
    assert.strictEqual(adapter.id, adapterName);
  });

  test(`${adapterName} fetchModels works offline against recorded fixtures`, async () => {
    const adapter = makeOfflineAdapter();
    const models = await adapter.fetchModels();
    assert.ok(Array.isArray(models));
    assert.strictEqual(models.length, fixtureModels.length);
    assert.deepStrictEqual(models, fixtureModels);
  });

  test(`${adapterName}: every normalized model is a valid CanonicalModel`, () => {
    const adapter = makeOfflineAdapter();
    for (const raw of fixtureModels) {
      const canonical = toCanon(adapter.normalize(raw), adapter);
      assertCanonicalModelValid(canonical, raw.id);
    }
  });

  test(`${adapterName}: isFree selection is consistent`, async () => {
    const adapter = makeOfflineAdapter();

    for (const raw of fixtureModels) {
      assert.strictEqual(
        adapter.isFree(raw),
        adapter.isFree(JSON.parse(JSON.stringify(raw))),
        `isFree is not deterministic for ${raw.id}`
      );

      const canonical = toCanon(adapter.normalize(raw), adapter);
      if (adapter.isFree(raw)) {
        assert.ok(
          canonical.pricing &&
            typeof canonical.pricing === 'object',
          `free model ${raw.id} lost its pricing through normalization`
        );
      }
    }

    const fetched = await adapter.fetchModels();
    assert.deepStrictEqual(
      fetched.filter((m) => adapter.isFree(m)).map((m) => m.id),
      fixtureModels.filter((m) => adapter.isFree(m)).map((m) => m.id),
      'isFree disagrees about which fixture models are free'
    );
  });

  test(`${adapterName}: harness fails loudly on missing required fields`, () => {
    const adapter = makeOfflineAdapter();
    const broken = JSON.parse(JSON.stringify(fixtureModels[0]));
    delete broken[requiredRawField];

    const canonical = toCanon(adapter.normalize(broken), adapter);
    assert.throws(
      () => assertCanonicalModelValid(canonical, broken.name),
      /failed validation/,
      'removing id must surface a CanonicalModel schema failure, not an incidental throw'
    );
  });
}

module.exports = {
  loadFixtureModels,
  createOfflineFetch,
  assertCanonicalModelValid,
  runAdapterContract,
};
