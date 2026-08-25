'use strict';

// Live smoke checks (#54): hit each provider's real models endpoint and
// assert basic contract conformance. Fully opt-in — every test is skipped
// unless RUN_LIVE_SMOKE=1 or the provider's API key env var is present, so
// `npm test` stays offline and zero-cost in CI.

const { test } = require('node:test');
const assert = require('node:assert');

require('dotenv').config({ quiet: true });

const { createOpenRouterAdapter } = require('../lib/providers/openrouter');
const { createGroqAdapter } = require('../lib/providers/groq');
const { createGoogleAdapter } = require('../lib/providers/google');
const { validateCanonicalModel } = require('../lib/providers/schema');

const PROVIDERS = [
  {
    id: 'openrouter',
    keyEnv: 'OPENROUTER_API_KEY',
    create: () => createOpenRouterAdapter(),
    // OpenRouter's public catalog endpoint is keyless (allowKeylessFetch),
    // but only run it when smoke mode is explicitly requested so plain
    // `npm test` never touches the network.
    requiresKey: false,
  },
  {
    id: 'groq',
    keyEnv: 'GROQ_API_KEY',
    create: () => createGroqAdapter(),
    requiresKey: true,
  },
  {
    id: 'google',
    keyEnv: 'GOOGLE_AI_API_KEY',
    create: () => createGoogleAdapter(),
    requiresKey: true,
  },
];

function isSmokeEnabled(provider) {
  if (process.env.RUN_LIVE_SMOKE === '1') return true;
  return Boolean(process.env[provider.keyEnv]);
}

for (const provider of PROVIDERS) {
  const enabled = isSmokeEnabled(provider);
  const missingKey = provider.requiresKey && !process.env[provider.keyEnv];

  test(`live smoke: ${provider.id} models endpoint returns valid canonical models`, { skip: enabled ? false : 'set RUN_LIVE_SMOKE=1 (or the provider API key) to enable' }, async () => {
    if (missingKey) {
      assert.fail(`${provider.id} smoke enabled but ${provider.keyEnv} is not set`);
    }

    const adapter = provider.create();
    const rawModels = await adapter.fetchModels();

    // Basic HTTP-shape conformance.
    assert.ok(Array.isArray(rawModels), `${provider.id}: expected an array of raw models`);

    const free = rawModels.filter((m) => adapter.isFree(m));
    assert.ok(free.length > 0, `${provider.id}: expected at least one free model`);

    const invalid = [];
    for (const raw of free) {
      const canonical = adapter.normalize(raw);
      const result = validateCanonicalModel(canonical);
      if (!result.valid) {
        invalid.push(`${canonical?.id ?? '<unknown>'}: ${result.errors.join('; ')}`);
      }
    }
    assert.deepStrictEqual(
      invalid,
      [],
      `${provider.id}: free models failed validateCanonicalModel:\n  - ${invalid.join('\n  - ')}`
    );
  });
}
