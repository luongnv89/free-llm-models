const { test } = require('node:test');
const assert = require('node:assert');

const {
  shouldFetchRankingsDaily,
  attachPopularity,
  matchRankingsDaily,
  relativeRankFromTopWeekly,
  pickLatestRankingsDay,
} = require('../get_openrouter_free_models.js');

const rankingsDaily = {
  data: [
    { date: '2026-08-24', model_permaslug: 'openai/gpt-4o', total_tokens: '9000' },
    { date: '2026-08-24', model_permaslug: 'google/gemini-flash', total_tokens: '4000' },
    { date: '2026-08-24', model_permaslug: 'other', total_tokens: '1000' },
    { date: '2026-08-23', model_permaslug: 'openai/gpt-4o', total_tokens: '100' },
  ],
  meta: { as_of: '2026-08-25T02:00:00Z' },
};

test('shouldFetchRankingsDaily is true only when an API key is set', () => {
  assert.strictEqual(shouldFetchRankingsDaily('sk-or-v1-test'), true);
  assert.strictEqual(shouldFetchRankingsDaily(''), false);
  assert.strictEqual(shouldFetchRankingsDaily(null), false);
  assert.strictEqual(shouldFetchRankingsDaily('   '), false);
});

test('pickLatestRankingsDay uses the newest date and skips the other row', () => {
  const day = pickLatestRankingsDay(rankingsDaily);
  assert.strictEqual(day.date, '2026-08-24');
  assert.deepStrictEqual(
    day.rows.map((r) => r.model_permaslug),
    ['openai/gpt-4o', 'google/gemini-flash']
  );
  assert.strictEqual(day.asOf, '2026-08-25T02:00:00Z');
});

test('matches rankings-daily by canonical_slug', () => {
  const day = pickLatestRankingsDay(rankingsDaily);
  const hit = matchRankingsDaily(
    { id: 'openai/gpt-4o:free', canonical_slug: 'openai/gpt-4o' },
    day.rows
  );
  assert.deepStrictEqual(hit, {
    rank: 1,
    tokens: 9000,
    source: 'rankings-daily',
  });
});

test('matches rankings-daily :free variants against the base slug', () => {
  const day = pickLatestRankingsDay(rankingsDaily);
  const hit = matchRankingsDaily(
    { id: 'google/gemini-flash:free', canonical_slug: 'google/gemini-flash:free' },
    day.rows
  );
  assert.strictEqual(hit.rank, 2);
  assert.strictEqual(hit.tokens, 4000);
  assert.strictEqual(hit.source, 'rankings-daily');
});

test('relative rank from top-weekly is among free ids only', () => {
  const topWeekly = [
    { id: 'paid/one' },
    { id: 'free/alpha:free' },
    { id: 'paid/two' },
    { id: 'free/beta:free' },
  ];
  const freeIds = ['free/alpha:free', 'free/beta:free'];
  assert.deepStrictEqual(
    relativeRankFromTopWeekly({ id: 'free/alpha:free' }, topWeekly, freeIds),
    { rank: 1, source: 'top-weekly' }
  );
  assert.deepStrictEqual(
    relativeRankFromTopWeekly({ id: 'free/beta:free' }, topWeekly, freeIds),
    { rank: 2, source: 'top-weekly' }
  );
});

test('attachPopularity prefers rankings-daily then falls back to top-weekly', () => {
  const models = [
    { id: 'openai/gpt-4o:free', canonical_slug: 'openai/gpt-4o' },
    { id: 'acme/only-weekly:free', canonical_slug: 'acme/only-weekly' },
    { id: 'acme/nobody:free', canonical_slug: 'acme/nobody' },
  ];
  const topWeekly = [
    { id: 'openai/gpt-4o:free' },
    { id: 'acme/only-weekly:free' },
  ];
  const result = attachPopularity({
    models,
    rankingsDaily,
    topWeekly,
    asOf: '2026-08-25T00:00:00.000Z',
    hasApiKey: true,
  });

  assert.deepStrictEqual(result[0].popularity, {
    rank: 1,
    tokens: 9000,
    source: 'rankings-daily',
    asOf: '2026-08-25T02:00:00Z',
  });
  assert.deepStrictEqual(result[1].popularity, {
    rank: 2,
    source: 'top-weekly',
    asOf: '2026-08-25T00:00:00.000Z',
  });
  assert.deepStrictEqual(result[2].popularity, {
    rank: null,
    tokens: null,
    source: 'rankings-daily',
    reason: 'unmatched',
    asOf: '2026-08-25T00:00:00.000Z',
  });
});

test('keyless path skips rankings-daily even when a payload is provided', () => {
  const models = [
    { id: 'openai/gpt-4o:free', canonical_slug: 'openai/gpt-4o' },
    { id: 'acme/only-weekly:free', canonical_slug: 'acme/only-weekly' },
  ];
  const topWeekly = [
    { id: 'openai/gpt-4o:free' },
    { id: 'acme/only-weekly:free' },
  ];
  const result = attachPopularity({
    models,
    rankingsDaily,
    topWeekly,
    asOf: '2026-08-25T00:00:00.000Z',
    hasApiKey: false,
  });

  assert.strictEqual(result[0].popularity.source, 'top-weekly');
  assert.strictEqual(result[0].popularity.rank, 1);
  assert.strictEqual(result[1].popularity.rank, 2);
  assert.ok(!('tokens' in result[0].popularity) || result[0].popularity.tokens == null);
});

test('unmatched with no ranking payloads records a miss reason', () => {
  const result = attachPopularity({
    models: [{ id: 'acme/x', canonical_slug: 'acme/x' }],
    rankingsDaily: null,
    topWeekly: null,
    asOf: '2026-08-25T00:00:00.000Z',
    hasApiKey: true,
  });
  assert.deepStrictEqual(result[0].popularity, {
    rank: null,
    tokens: null,
    source: 'rankings-daily',
    reason: 'unavailable',
    asOf: '2026-08-25T00:00:00.000Z',
  });
});
