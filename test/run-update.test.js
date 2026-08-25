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
  buildLegacyOpenRouterOutput,
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

test('per-provider history merges stay isolated across runs (same model id)', async () => {
  const dir = tmpDir();
  try {
    let t = 0;
    const stamps = ['2026-08-24T00:00:00.000Z', '2026-08-25T00:00:00.000Z'];
    const options = () =>
      makeRunnerOptions(
        [
          fakeAdapter('alpha', { rawModels: t === 0 ? [{ id: 'shared' }] : [] }),
          fakeAdapter('beta', { rawModels: [{ id: 'shared' }] }),
        ],
        dir,
        { now: () => stamps[t], log: () => {}, warn: () => {} }
      );

    await runUpdate(options());
    t = 1;
    await runUpdate(options());

    // alpha dropped the model: it is archived under alpha's providerId only.
    const alpha = JSON.parse(fs.readFileSync(path.join(dir, 'models', 'alpha.json'), 'utf8'));
    assert.deepStrictEqual(alpha.newModelIds, []);
    assert.strictEqual(alpha.archivedModels.length, 1);
    assert.strictEqual(alpha.archivedModels[0].providerId, 'alpha');
    assert.strictEqual(alpha.archivedModels[0].removedAt, stamps[1]);

    // beta still serves it: original join stamp preserved, nothing archived.
    const beta = JSON.parse(fs.readFileSync(path.join(dir, 'models', 'beta.json'), 'utf8'));
    assert.deepStrictEqual(beta.archivedModels, []);
    assert.strictEqual(beta.models[0].addedToFreeList, stamps[0]);
    assert.deepStrictEqual(beta.newModelIds, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a corrupt previous provider history starts fresh instead of failing', async () => {
  const dir = tmpDir();
  try {
    fs.mkdirSync(path.join(dir, 'models'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'models', 'groq.json'), '{not-json');

    const warnings = [];
    const summary = await runUpdate(
      makeRunnerOptions([fakeAdapter('groq', { rawModels: [{ id: 'g1' }] })], dir, {
        warn: (m) => warnings.push(m),
      })
    );

    assert.strictEqual(summary.exitCode, 0);
    assert.ok(warnings.some((w) => /unreadable, starting fresh/.test(w)));
    const doc = JSON.parse(fs.readFileSync(path.join(dir, 'models', 'groq.json'), 'utf8'));
    assert.deepStrictEqual(doc.newModelIds, ['g1']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a merge failure on one provider never blocks the others', async () => {
  const dir = tmpDir();
  try {
    const warnings = [];
    const summary = await runUpdate(
      makeRunnerOptions(
        [
          fakeAdapter('bad', { rawModels: [{ id: 'nul\u0000id' }] }),
          fakeAdapter('good', { rawModels: [{ id: 'g1' }] }),
        ],
        dir,
        { warn: (m) => warnings.push(m) }
      )
    );

    assert.strictEqual(summary.exitCode, 0);
    assert.deepStrictEqual(summary.succeeded.sort(), ['bad', 'good']);
    assert.ok(warnings.some((w) => /history merge for bad failed/.test(w)));

    // The failing provider is still emitted (without history fields).
    const bad = JSON.parse(fs.readFileSync(path.join(dir, 'models', 'bad.json'), 'utf8'));
    assert.strictEqual(bad.models[0].id, 'nul\u0000id');
    assert.strictEqual('newModelIds' in bad, false);

    // The healthy provider keeps its full history treatment.
    const good = JSON.parse(fs.readFileSync(path.join(dir, 'models', 'good.json'), 'utf8'));
    assert.deepStrictEqual(good.newModelIds, ['g1']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildLegacyOpenRouterOutput composes the history merge with popularity', async () => {
  const dir = tmpDir();
  try {
    const legacyPath = path.join(dir, 'legacy.json');
    const original = '2026-01-01T00:00:00.000Z';
    fs.writeFileSync(
      legacyPath,
      JSON.stringify({
        fetchedAt: '2026-08-20T00:00:00.000Z',
        models: [{ id: 'm1', name: 'M1', addedToFreeList: original }],
        archivedModels: [],
      })
    );

    const adapter = {
      id: 'openrouter',
      hasApiKey: () => false,
      fetchTopWeekly: async () => [{ id: 'm1' }],
    };

    const { output } = await buildLegacyOpenRouterOutput(
      adapter,
      [{ id: 'm1', name: 'M1' }, { id: 'm2', name: 'M2' }],
      '2026-08-25T00:00:00.000Z',
      { io: fs, outputPath: legacyPath, log: () => {}, warn: () => {} }
    );

    // History merge ran against the previous legacy snapshot...
    assert.strictEqual(output.totalModels, 2);
    assert.deepStrictEqual(output.newModelIds, ['m2']);
    assert.deepStrictEqual(output.archivedModels, []);
    assert.strictEqual(
      output.models.find((m) => m.id === 'm1').addedToFreeList,
      original
    );
    // ...and popularity attached on top of the merged rows.
    assert.deepStrictEqual(
      output.models.map((m) => [m.popularity?.source, m.popularity?.rank ?? null]),
      [['top-weekly', 1], ['top-weekly', null]]
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
