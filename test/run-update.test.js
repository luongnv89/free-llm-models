const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  createRegistry,
} = require('../lib/providers/registry');
const {
  parseProviderSelection,
  parseTimeoutMs,
  runUpdate,
  writeLegacyOpenRouterSnapshot,
} = require('../lib/providers/run-update');

function fakeAdapter(id, overrides = {}) {
  return {
    id,
    name: overrides.name ?? id,
    metadata: { id, displayName: overrides.name ?? id },
    allowKeylessFetch: overrides.allowKeylessFetch ?? true,
    hasApiKey: () => overrides.hasApiKey ?? true,
    fetchModels:
      overrides.fetchModels ??
      (async () => overrides.rawModels ?? [
        {
          id: `${id}-model`,
          name: `${id} Model`,
          created: 1,
          description: '',
          context_length: null,
          pricing: { prompt: '0', completion: '0' },
          architecture: {
            modality: 'text->text',
            input_modalities: ['text'],
            output_modalities: ['text'],
          },
        },
      ]),
    isFree: () => true,
    normalize: (m) => ({ ...m, providerId: id }),
    ...(overrides.openrouterExtras ?? {}),
  };
}

function failingAdapter(id, message = 'HTTP 500: boom') {
  return fakeAdapter(id, {
    fetchModels: async () => {
      throw new Error(message);
    },
  });
}

function makeRunnerOptions(registryAdapters, dir, overrides = {}) {
  const registry = createRegistry();
  registryAdapters.forEach((a) => registry.registerProvider(a));
  return {
    registry,
    outputDir: overrides.outputDir ?? path.join(dir, 'models'),
    legacyOutputPath: overrides.legacyOutputPath ?? path.join(dir, 'legacy.json'),
    now: () => '2026-08-25T00:00:00.000Z',
    log: () => {},
    warn: () => {},
    ...overrides,
  };
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'run-update-test-'));
}

test('one provider failing never blocks the others; outputs still written', async () => {
  const dir = tmpDir();
  try {
    const options = makeRunnerOptions(
      [
        failingAdapter('groq'),
        fakeAdapter('openrouter', {
          rawModels: [{ id: 'or-1' }],
        }),
        fakeAdapter('google', {
          rawModels: [{ id: 'gem-1' }],
        }),
      ],
      dir
    );

    const summary = await runUpdate(options);

    assert.deepStrictEqual(summary.succeeded, ['openrouter', 'google']);
    assert.deepStrictEqual(summary.failed, [
      { id: 'groq', error: 'HTTP 500: boom' },
    ]);
    assert.deepStrictEqual(summary.skipped, []);
    assert.strictEqual(summary.exitCode, 0);

    // Per-provider files exist only for successful providers.
    assert.ok(fs.existsSync(path.join(dir, 'models', 'openrouter.json')));
    assert.ok(fs.existsSync(path.join(dir, 'models', 'google.json')));
    assert.ok(!fs.existsSync(path.join(dir, 'models', 'groq.json')));

    // Merged index reflects only the survivors.
    const index = JSON.parse(
      fs.readFileSync(path.join(dir, 'models', 'index.json'), 'utf8')
    );
    assert.deepStrictEqual(index.providers.map((p) => p.id), ['openrouter', 'google']);
    assert.strictEqual(summary.index.providers.length, 2);
    assert.deepStrictEqual(
      index.models.map((m) => m.id),
      ['or-1', 'gem-1']
    );

    // Legacy OpenRouter snapshot was still refreshed.
    assert.strictEqual(summary.legacyPath, path.join(dir, 'legacy.json'));
    const legacy = JSON.parse(fs.readFileSync(summary.legacyPath, 'utf8'));
    assert.deepStrictEqual(Object.keys(legacy), [
      'fetchedAt',
      'totalModels',
      'newModelIds',
      'models',
      'archivedModels',
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('all providers failing yields exitCode 1 and emits nothing', async () => {
  const dir = tmpDir();
  try {
    const outputDir = path.join(dir, 'models');
    const summary = await runUpdate(
      makeRunnerOptions([failingAdapter('a'), failingAdapter('b')], dir)
    );

    assert.deepStrictEqual(summary.succeeded, []);
    assert.deepStrictEqual(
      summary.failed.map((f) => f.id),
      ['a', 'b']
    );
    assert.strictEqual(summary.exitCode, 1);
    assert.ok(!fs.existsSync(outputDir), 'no output directory is created');
    assert.strictEqual(summary.legacyPath, undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('providers without API keys are skipped, not failed', async () => {
  const dir = tmpDir();
  try {
    const summary = await runUpdate(
      makeRunnerOptions(
        [fakeAdapter('needs-key', { hasApiKey: false, allowKeylessFetch: false }), fakeAdapter('ok')],
        dir
      )
    );

    assert.deepStrictEqual(summary.succeeded, ['ok']);
    assert.deepStrictEqual(summary.skipped, [
      { id: 'needs-key', reason: 'missing-api-key' },
    ]);
    assert.deepStrictEqual(summary.failed, []);
    assert.strictEqual(summary.exitCode, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('provider selection restricts the run; unknown ids are skipped', async () => {
  const dir = tmpDir();
  try {
    const summary = await runUpdate(
      makeRunnerOptions(
        [fakeAdapter('openrouter'), fakeAdapter('groq'), fakeAdapter('google')],
        dir,
        { providers: ['groq', 'ghost'] }
      )
    );

    assert.deepStrictEqual(summary.succeeded, ['groq']);
    assert.deepStrictEqual(summary.skipped, [
      { id: 'ghost', reason: 'unknown-provider' },
    ]);
    assert.ok(!fs.existsSync(path.join(dir, 'models', 'openrouter.json')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('per-provider timeout fails only the hung provider without unhandled rejections', async () => {
  const dir = tmpDir();
  try {
    const hung = fakeAdapter('hung', {
      fetchModels: () =>
        new Promise((resolve) => {
          // Intentionally never resolves within the test's lifetime.
          setTimeout(resolve, 5000);
        }),
    });
    const summary = await runUpdate(
      makeRunnerOptions([hung, fakeAdapter('fast', { rawModels: [{ id: 'f1' }] })], dir, {
        timeoutMs: 30,
      })
    );

    assert.strictEqual(summary.exitCode, 0);
    assert.deepStrictEqual(summary.succeeded, ['fast']);
    assert.strictEqual(summary.failed.length, 1);
    assert.strictEqual(summary.failed[0].id, 'hung');
    assert.match(summary.failed[0].error, /timed out after 30ms/);

    // Give any stray unhandled rejection a tick to surface.
    await new Promise((resolve) => setTimeout(resolve, 50));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('parseProviderSelection normalizes csv input; empty means all', () => {
  assert.strictEqual(parseProviderSelection(undefined), null);
  assert.strictEqual(parseProviderSelection(null), null);
  assert.strictEqual(parseProviderSelection(''), null);
  assert.deepStrictEqual(parseProviderSelection('groq, google ,'), ['groq', 'google']);
  assert.deepStrictEqual(parseProviderSelection('a,a,b'), ['a', 'b']);
  assert.deepStrictEqual(parseProviderSelection(['x', 'y']), ['x', 'y']);
});

test('parseTimeoutMs falls back on invalid values', () => {
  assert.strictEqual(parseTimeoutMs(undefined), 30000);
  assert.strictEqual(parseTimeoutMs(''), 30000);
  assert.strictEqual(parseTimeoutMs('nope'), 30000);
  assert.strictEqual(parseTimeoutMs('-5'), 30000);
  assert.strictEqual(parseTimeoutMs('1500'), 1500);
  assert.strictEqual(parseTimeoutMs(undefined, 100), 100);
});

test('writeLegacyOpenRouterSnapshot honours io injection (no network, no repo writes)', async () => {
  const dir = tmpDir();
  try {
    const legacyPath = path.join(dir, 'legacy.json');
    const calls = [];
    const io = new Proxy(fs, {
      get(target, prop) {
        if (['writeFileSync', 'renameSync', 'mkdirSync'].includes(prop)) {
          return (...args) => {
            calls.push(prop);
            return target[prop](...args);
          };
        }
        return target[prop];
      },
    });

    const written = await writeLegacyOpenRouterSnapshot({
      adapter: {
        id: 'openrouter',
        name: 'OpenRouter',
        hasApiKey: () => false,
        fetchRankingsDaily: async () => [],
        fetchTopWeekly: async () => [],
      },
      freeModels: [],
      fetchedAt: '2026-08-25T00:00:00.000Z',
      io,
      outputPath: legacyPath,
      log: () => {},
    });

    assert.strictEqual(written, legacyPath);
    assert.deepStrictEqual(calls.sort(), ['mkdirSync', 'renameSync', 'writeFileSync']);
    assert.ok(fs.existsSync(legacyPath));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
