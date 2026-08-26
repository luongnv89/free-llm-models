const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createRegistry } = require('../lib/providers/registry');
const { createOpenRouterAdapter } = require('../lib/providers/openrouter');
const { createGroqAdapter } = require('../lib/providers/groq');
const { createGoogleAdapter } = require('../lib/providers/google');
const { runUpdate } = require('../lib/providers/run-update');

const FIXTURES = path.join(__dirname, 'fixtures');
const openrouterFixture = JSON.parse(
  fs.readFileSync(path.join(FIXTURES, 'openrouter-models.json'), 'utf8')
);
const groqFixture = JSON.parse(
  fs.readFileSync(path.join(FIXTURES, 'groq-models.json'), 'utf8')
);
const googleFixture = JSON.parse(
  fs.readFileSync(path.join(FIXTURES, 'google-models.json'), 'utf8')
);

const OR_MODELS = 'https://openrouter.ai/api/v1/models';
const OR_TOP_WEEKLY = 'https://openrouter.ai/api/v1/models?sort=top-weekly';
const OR_RANKINGS_DAILY =
  'https://openrouter.ai/api/v1/datasets/rankings-daily';
const GROQ_MODELS = 'https://api.groq.com/openai/v1/models';
const GOOGLE_MODELS_PREFIX =
  'https://generativelanguage.googleapis.com/v1beta/models';

const STAMP_1 = '2026-08-24T00:00:00.000Z';
const STAMP_2 = '2026-08-25T00:00:00.000Z';

// --- Fixture plumbing -------------------------------------------------------

/**
 * Build an offline fetch implementation serving canned HTTP responses per
 * URL prefix. Any request without a registered route throws, guaranteeing
 * the pipeline under test can never touch the live network.
 */
function makeOfflineFetch(routes) {
  const requested = [];
  return {
    requested,
    fetchImpl: async (url) => {
      requested.push(String(url));
      const match = Object.keys(routes).find((prefix) =>
        String(url).startsWith(prefix)
      );
      if (!match) {
        throw new Error(`unexpected network request in offline test: ${url}`);
      }
      return routes[match];
    },
  };
}

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

function errorResponse(status, message) {
  return {
    ok: false,
    status,
    text: async () => message,
    json: async () => ({ error: message }),
  };
}

/** Rankings-daily dataset payload matching the gpt-oss OpenRouter model. */
function rankingsDailyFixture(date = '2026-08-24') {
  return {
    meta: { as_of: `${date}T12:00:00Z` },
    data: [
      {
        date,
        model_permaslug: 'openai/gpt-oss-120b',
        total_tokens: 987654,
      },
    ],
  };
}

function topWeeklyFixture(ids) {
  return { data: ids.map((id) => ({ id })) };
}

/** Default route table covering every endpoint the three adapters hit. */
function baseRoutes({
  openrouterModels = openrouterFixture,
  groqModels = groqFixture,
  googleModels = googleFixture,
} = {}) {
  return {
    [OR_RANKINGS_DAILY]: jsonResponse(rankingsDailyFixture()),
    [OR_TOP_WEEKLY]: jsonResponse(
      topWeeklyFixture([
        'meta-llama/llama-3.3-70b-instruct:free',
        'openai/gpt-oss-120b:free',
        'paid-but-popular',
      ])
    ),
    [OR_MODELS]: jsonResponse(openrouterModels),
    [GROQ_MODELS]: jsonResponse(groqModels),
    [GOOGLE_MODELS_PREFIX]: jsonResponse(googleModels),
  };
}

/**
 * Real adapters (real fetch/normalize/isFree paths) wired to the offline
 * fetch. The OpenRouter adapter carries a fake API key so the legacy
 * snapshot writer also exercises the rankings-daily endpoint.
 */
function buildRegistry(routes) {
  const { fetchImpl } = makeOfflineFetch(routes);
  const registry = createRegistry();
  registry.registerProvider(
    createOpenRouterAdapter({ apiKey: 'test-key', fetchImpl })
  );
  registry.registerProvider(createGroqAdapter({ apiKey: 'test-key', fetchImpl }));
  registry.registerProvider(
    createGoogleAdapter({ apiKey: 'test-key', fetchImpl })
  );
  return registry;
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-e2e-test-'));
}

async function runPipeline(dir, { now, routes = baseRoutes() }) {
  return runUpdate({
    registry: buildRegistry(routes),
    outputDir: path.join(dir, 'models'),
    legacyOutputPath: path.join(dir, 'openrouter_free_models.json'),
    now,
    log: () => {},
    warn: () => {},
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// --- Tests ------------------------------------------------------------------

test('end-to-end: fixtures through runUpdate to per-provider files, index and legacy snapshot', async () => {
  const dir = tmpDir();
  try {
    const summary = await runPipeline(dir, { now: () => STAMP_1 });

    // Every provider succeeded through its real adapter.
    assert.deepStrictEqual(summary.succeeded, ['openrouter', 'groq', 'google']);
    assert.deepStrictEqual(summary.failed, []);
    assert.deepStrictEqual(summary.skipped, []);
    assert.strictEqual(summary.exitCode, 0);

    // Exact output set: one file per provider + merged index (+ legacy outside).
    const modelsDir = path.join(dir, 'models');
    assert.deepStrictEqual(fs.readdirSync(modelsDir).sort(), [
      'google.json',
      'groq.json',
      'index.json',
      'openrouter.json',
    ]);
    assert.ok(fs.existsSync(path.join(dir, 'openrouter_free_models.json')));

    // Index correctness: canonical provider order, counts match files.
    const index = readJson(path.join(modelsDir, 'index.json'));
    assert.deepStrictEqual(
      index.providers.map((p) => [p.id, p.modelCount]),
      [
        ['openrouter', 2],
        ['groq', 3],
        ['google', 3],
      ]
    );
    for (const p of index.providers) {
      assert.strictEqual(p.fetchedAt, STAMP_1);
      assert.ok(p.metadata && p.metadata.displayName);
    }

    // Cross-file consistency: index.models is exactly the concat of the
    // per-provider files, each stamped with its providerId.
    const idsByProvider = {};
    const perProviderModels = ['openrouter', 'groq', 'google'].flatMap((id) => {
      const doc = readJson(path.join(modelsDir, `${id}.json`));
      assert.strictEqual(doc.providerId, id);
      assert.strictEqual(doc.fetchedAt, STAMP_1);
      idsByProvider[id] = doc.models.map((m) => m.id);
      assert.strictEqual(doc.models.length, index.providers.find((p) => p.id === id).modelCount);
      // OpenRouter's canonical shape is the raw API entry (no injected
      // fields); the derived adapters stamp their providerId.
      if (id !== 'openrouter') {
        for (const m of doc.models) assert.strictEqual(m.providerId, id);
      }
      return doc.models;
    });
    assert.strictEqual(index.models.length, perProviderModels.length);
    assert.deepStrictEqual(index.models, perProviderModels);

    // Free filtering happened inside the real adapters (paid/inactive/non-
    // generative entries excluded everywhere).
    assert.ok(idsByProvider.openrouter.includes('openai/gpt-oss-120b:free'));
    assert.ok(!idsByProvider.openrouter.includes('anthropic/claude-3.5-sonnet'));
    assert.ok(!idsByProvider.groq.includes('whisper-large-v3'));
    assert.ok(!idsByProvider.google.includes('gemini-embedding-001'));

    // Legacy snapshot: history merge + popularity from rankings-daily.
    const legacy = readJson(path.join(dir, 'openrouter_free_models.json'));
    assert.deepStrictEqual(Object.keys(legacy), [
      'fetchedAt',
      'totalModels',
      'newModelIds',
      'models',
      'archivedModels',
    ]);
    assert.strictEqual(legacy.totalModels, 2);
    assert.deepStrictEqual(legacy.newModelIds.sort(), [
      'meta-llama/llama-3.3-70b-instruct:free',
      'openai/gpt-oss-120b:free',
    ]);
    assert.deepStrictEqual(legacy.archivedModels, []);

    const ranked = legacy.models.find((m) => m.id === 'openai/gpt-oss-120b:free');
    assert.deepStrictEqual(ranked.popularity, {
      rank: 1,
      tokens: 987654,
      source: 'rankings-daily',
      asOf: '2026-08-24T12:00:00Z',
    });
    // Model absent from rankings-daily falls back to the top-weekly
    // relative rank (it is first among free models in that fixture).
    const unranked = legacy.models.find(
      (m) => m.id === 'meta-llama/llama-3.3-70b-instruct:free'
    );
    assert.deepStrictEqual(unranked.popularity, {
      rank: 1,
      source: 'top-weekly',
      asOf: STAMP_1,
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('end-to-end: second run merges history per provider (archived/new/carry-forward)', async () => {
  const dir = tmpDir();
  try {
    await runPipeline(dir, { now: () => STAMP_1 });

    // Second day: OpenRouter drops the Llama model and gains a Mistral one;
    // Groq and Google catalogs are unchanged.
    const dropped = 'meta-llama/llama-3.3-70b-instruct:free';
    const added = 'mistralai/mistral-small:free';
    const dayTwoCatalog = {
      data: [
        openrouterFixture.data[0],
        openrouterFixture.data[2],
        {
          id: added,
          canonical_slug: 'mistralai/mistral-small',
          name: 'Mistral: Mistral Small (free)',
          created: 1756000000,
          description: 'New free arrival.',
          context_length: 32768,
          architecture: {
            modality: 'text->text',
            input_modalities: ['text'],
            output_modalities: ['text'],
          },
          pricing: { prompt: '0', completion: '0' },
        },
      ],
    };

    await runPipeline(dir, {
      now: () => STAMP_2,
      routes: baseRoutes({ openrouterModels: dayTwoCatalog }),
    });

    const modelsDir = path.join(dir, 'models');

    // OpenRouter slice: removal archived, arrival flagged, survivors keep
    // their original join stamp.
    const or = readJson(path.join(modelsDir, 'openrouter.json'));
    assert.deepStrictEqual(or.newModelIds, [added]);
    assert.strictEqual(or.archivedModels.length, 1);
    assert.strictEqual(or.archivedModels[0].id, dropped);
    assert.strictEqual(or.archivedModels[0].providerId, 'openrouter');
    assert.strictEqual(or.archivedModels[0].removedAt, STAMP_2);
    const survivor = or.models.find((m) => m.id === 'openai/gpt-oss-120b:free');
    assert.strictEqual(survivor.addedToFreeList, STAMP_1);
    assert.strictEqual(
      or.models.find((m) => m.id === added).addedToFreeList,
      STAMP_2
    );

    // Cross-provider isolation: untouched slices archive nothing and carry
    // their own history forward independently.
    const groq = readJson(path.join(modelsDir, 'groq.json'));
    assert.deepStrictEqual(groq.newModelIds, []);
    assert.deepStrictEqual(groq.archivedModels, []);
    for (const m of groq.models) assert.strictEqual(m.addedToFreeList, STAMP_1);

    const google = readJson(path.join(modelsDir, 'google.json'));
    assert.deepStrictEqual(google.newModelIds, []);
    assert.deepStrictEqual(google.archivedModels, []);
    for (const m of google.models)
      assert.strictEqual(m.addedToFreeList, STAMP_1);

    // Index stayed consistent with the refreshed files.
    const index = readJson(path.join(modelsDir, 'index.json'));
    assert.deepStrictEqual(
      index.providers.map((p) => [p.id, p.modelCount, p.fetchedAt]),
      [
        ['openrouter', 2, STAMP_2],
        ['groq', 3, STAMP_2],
        ['google', 3, STAMP_2],
      ]
    );
    assert.strictEqual(index.models.length, 8);

    // Legacy snapshot mirrored the same transition.
    const legacy = readJson(path.join(dir, 'openrouter_free_models.json'));
    assert.deepStrictEqual(legacy.newModelIds, [added]);
    assert.ok(legacy.archivedModels.some((a) => a.id === dropped));
    assert.strictEqual(legacy.totalModels, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('end-to-end: injected provider failure isolates cleanly across a rerun', async () => {
  const dir = tmpDir();
  try {
    // Day one succeeds fully, writing all three provider files.
    await runPipeline(dir, { now: () => STAMP_1 });

    // Day two: Groq's endpoint returns HTTP 500 while the others are healthy.
    const summary = await runPipeline(dir, {
      now: () => STAMP_2,
      routes: {
        ...baseRoutes(),
        [GROQ_MODELS]: errorResponse(500, 'internal error'),
      },
    });

    assert.deepStrictEqual(summary.succeeded, ['openrouter', 'google']);
    assert.deepStrictEqual(summary.failed, [
      { id: 'groq', error: 'HTTP 500: internal error' },
    ]);
    assert.strictEqual(summary.exitCode, 0);

    // The failed provider's stale file was pruned so the directory never
    // advertises data the index omits; survivors were rewritten.
    const modelsDir = path.join(dir, 'models');
    assert.deepStrictEqual(fs.readdirSync(modelsDir).sort(), [
      'google.json',
      'index.json',
      'openrouter.json',
    ]);

    const index = readJson(path.join(modelsDir, 'index.json'));
    assert.deepStrictEqual(index.providers.map((p) => p.id), [
      'openrouter',
      'google',
    ]);

    // Survivors kept merging against their day-one history despite the outage.
    const or = readJson(path.join(modelsDir, 'openrouter.json'));
    assert.deepStrictEqual(or.newModelIds, []);
    assert.deepStrictEqual(or.archivedModels, []);
    for (const m of or.models) assert.strictEqual(m.addedToFreeList, STAMP_1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
