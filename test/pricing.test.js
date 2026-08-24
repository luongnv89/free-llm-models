const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { isFreePricing } = require('../get_openrouter_free_models.js');

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'pricing.json'), 'utf8')
);

test('isFreePricing returns true for exact zero prompt and completion pricing', () => {
  const model = fixture.models.find((m) => m.id === 'free/exact-zero');
  assert.strictEqual(isFreePricing(model.pricing), true);
});

test('isFreePricing returns false when both prices are non-zero', () => {
  const model = fixture.models.find((m) => m.id === 'paid/both-nonzero');
  assert.strictEqual(isFreePricing(model.pricing), false);
});

test('isFreePricing returns false when only prompt is priced', () => {
  const model = fixture.models.find((m) => m.id === 'paid/prompt-only');
  assert.strictEqual(isFreePricing(model.pricing), false);
});

test('isFreePricing returns false when only completion is priced', () => {
  const model = fixture.models.find((m) => m.id === 'paid/completion-only');
  assert.strictEqual(isFreePricing(model.pricing), false);
});

test('isFreePricing treats missing pricing as not free', () => {
  assert.strictEqual(isFreePricing(), false);
});

test('isFreePricing uses strict string equality, not numeric coercion', () => {
  assert.strictEqual(isFreePricing({ prompt: '-0', completion: '0' }), false);
});

test('fixture filter mirrors the updater pipeline selection', () => {
  const freeModels = fixture.models.filter((m) => isFreePricing(m.pricing));
  assert.deepStrictEqual(
    freeModels.map((m) => m.id),
    ['free/exact-zero']
  );
});
