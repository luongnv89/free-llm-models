const { test } = require('node:test');
const assert = require('node:assert');

const { parseArgs } = require('../get_openrouter_free_models');

test('parseArgs accepts --providers=VALUE', () => {
  assert.deepStrictEqual(parseArgs(['--providers=groq,google']), {
    providers: 'groq,google',
  });
});

test('parseArgs accepts space-separated --providers VALUE', () => {
  assert.deepStrictEqual(parseArgs(['--providers', 'groq google']), {
    providers: 'groq google',
  });
});

test('parseArgs falls back to PROVIDERS env when flag absent', () => {
  const original = process.env.PROVIDERS;
  try {
    process.env.PROVIDERS = 'openrouter';
    assert.deepStrictEqual(parseArgs([]), { providers: 'openrouter' });
    assert.deepStrictEqual(parseArgs(['--verbose']), { providers: 'openrouter' });
  } finally {
    if (original === undefined) delete process.env.PROVIDERS;
    else process.env.PROVIDERS = original;
  }
});

test('parseArgs last flag wins; empty value means all providers downstream', () => {
  assert.strictEqual(
    parseArgs(['--providers=groq', '--providers=']).providers,
    ''
  );
});
