const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  openRouterModelToCanonical,
  canonicalToOpenRouterModel,
  validateCanonicalModel,
  defineProviderMetadata,
} = require('../lib/providers/schema');

const data = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', 'web', 'public', 'openrouter_free_models.json'),
    'utf8'
  )
);

test('every committed model maps to a valid CanonicalModel', () => {
  const models = data.models.concat((data.archivedModels || []).map((a) => a.model));
  assert.ok(models.length > 0);
  for (const model of models) {
    const canonical = openRouterModelToCanonical(model);
    const { valid, errors } = validateCanonicalModel(canonical);
    assert.deepStrictEqual(errors, [], `invalid canonical model: ${model.id}`);
    assert.strictEqual(valid, true);
    assert.strictEqual(canonical.providerId, 'openrouter');
  }
});

test('round-trip through CanonicalModel preserves every committed field', () => {
  const models = data.models.concat((data.archivedModels || []).map((a) => a.model));
  for (const model of models) {
    const canonical = openRouterModelToCanonical(model, {
      sourceUrl: null,
      rateLimits: null,
    });
    assert.deepStrictEqual(canonicalToOpenRouterModel(canonical), model);
  }
});

test('round-trip keeps provider metadata fields out of the raw shape', () => {
  const model = data.models[0];
  const canonical = openRouterModelToCanonical(model, {
    rateLimits: { requestsPerMinute: 20 },
  });
  assert.strictEqual(canonical.sourceUrl, 'https://openrouter.ai/api/v1/models');
  assert.deepStrictEqual(canonical.rateLimits, { requestsPerMinute: 20 });
  assert.strictEqual('providerId' in canonicalToOpenRouterModel(canonical), false);
  assert.strictEqual('sourceUrl' in canonicalToOpenRouterModel(canonical), false);
  assert.strictEqual('rateLimits' in canonicalToOpenRouterModel(canonical), false);
});

test('validateCanonicalModel rejects models missing required fields', () => {
  const { valid, errors } = validateCanonicalModel({ id: 'x/y' });
  assert.strictEqual(valid, false);
  assert.ok(errors.some((e) => e.includes('providerId')));
  assert.ok(errors.some((e) => e.includes('pricing')));
  assert.ok(errors.some((e) => e.includes('architecture')));
});

test('validateCanonicalModel accepts optional sourceUrl and rateLimits variants', () => {
  const base = openRouterModelToCanonical(data.models[0]);
  for (const patch of [
    {},
    { rateLimits: {} },
    { rateLimits: { tokensPerMinute: 1000 } },
  ]) {
    const { valid, errors } = validateCanonicalModel({ ...base, ...patch });
    assert.strictEqual(valid, true, errors.join('; '));
  }
});

test('defineProviderMetadata fills defaults and rejects invalid metadata', () => {
  const provider = defineProviderMetadata({ id: 'openrouter', displayName: 'OpenRouter' });
  assert.deepStrictEqual(provider, {
    id: 'openrouter',
    displayName: 'OpenRouter',
    baseUrl: null,
    apiKeySignupUrl: null,
    docsUrl: null,
    openaiCompatibleBaseUrl: null,
    notes: null,
  });

  assert.throws(() => defineProviderMetadata({ displayName: 'No id' }), /id/);
  assert.throws(() => defineProviderMetadata({ id: 'x', displayName: '' }), /displayName/);
});
