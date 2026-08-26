const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..');
const UPDATER = path.join(REPO, 'scripts', 'openrouter-free-models-update.sh');
const UPDATE_DATA = path.join(REPO, 'scripts', 'update_data.sh');
const LIB = path.join(REPO, 'scripts', 'lib', 'updater-common.sh');

function sourceLib(snippet, env = {}, cwd) {
  // Source the lib in a bash child and run an extra snippet against it.
  const script = `set -euo pipefail; source ${JSON.stringify(LIB)}; ${snippet}`;
  return spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    cwd,
    env: { ...process.env, ...env },
  });
}

test('updater script passes bash syntax check', () => {
  const r = spawnSync('bash', ['-n', UPDATER], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
});

test('updater-common lib passes bash syntax check', () => {
  const r = spawnSync('bash', ['-n', LIB], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
});

test('update_data.sh passes bash syntax check', () => {
  const r = spawnSync('bash', ['-n', UPDATE_DATA], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
});

test('updater contains no hardcoded version-manager node path', () => {
  const src = fs.readFileSync(UPDATER, 'utf8');
  assert.doesNotMatch(src, /installs\/node/);
  assert.doesNotMatch(src, /node\/\d+\.\d+\.\d+/);
});

test('updater uses lockfile-driven npm ci on install paths', () => {
  const src = fs.readFileSync(UPDATER, 'utf8');
  assert.ok(/npm ci/.test(src), 'script should invoke npm ci');
  assert.doesNotMatch(src, /^\s*npm install/m, 'no floating npm install allowed');
});

// ── Multi-provider output coverage (#57) ────────────────────────────────────
const MODELS_DIR = path.join('web', 'public', 'models');

function commitScriptsCoverAllOutputs() {
  for (const file of [UPDATER, UPDATE_DATA]) {
    const src = fs.readFileSync(file, 'utf8');
    assert.match(
      src,
      /updater_data_dirty/,
      `${path.basename(file)} must gate commits on the full dataset path set`
    );
    assert.match(
      src,
      /updater_stage_data/,
      `${path.basename(file)} must stage the full dataset path set`
    );
    assert.doesNotMatch(
      src,
      /git diff --quiet -- "\$DATA_FILE"/,
      `${path.basename(file)} must not diff only the legacy file`
    );
  }
  const lib = fs.readFileSync(LIB, 'utf8');
  assert.match(lib, /web\/public\/models/, 'lib declares the models/ output dir');
  assert.match(
    lib,
    /openrouter_free_models\.json/,
    'lib keeps the legacy snapshot in the path set'
  );
}

test('commit logic covers multi-provider outputs and legacy file', () => {
  commitScriptsCoverAllOutputs();
});

function seedDataFiles(dir) {
  fs.mkdirSync(path.join(dir, MODELS_DIR), { recursive: true });
  fs.writeFileSync(path.join(dir, MODELS_DIR, 'index.json'), '{"providers":[]}\n');
  fs.writeFileSync(path.join(dir, MODELS_DIR, 'openrouter.json'), '[]\n');
  fs.writeFileSync(path.join(dir, 'web/public/openrouter_free_models.json'), '[]\n');
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'seed data'], { cwd: dir });
}

test('updater_data_paths lists models dir and legacy snapshot', () => {
  const r = sourceLib('mapfile -t p < <(updater_data_paths); echo "count=${#p[@]}"; printf "%s\\n" "${p[@]}"', {}, REPO);
  assert.strictEqual(r.status, 0);
  const lines = r.stdout.trim().split('\n');
  assert.strictEqual(lines[0], 'count=2');
  assert.ok(lines.includes('web/public/models'));
  assert.ok(lines.includes('web/public/openrouter_free_models.json'));
});

test('updater_data_dirty ignores clean trees, flags any generated change', () => {
  const dir = makeScratchRepo();
  try {
    seedDataFiles(dir);

    // Clean tree → not dirty
    let r = sourceLib('updater_data_dirty', {}, dir);
    assert.notStrictEqual(r.status, 0, 'clean data tree must not be dirty');

    // Modified provider file → dirty
    fs.appendFileSync(path.join(dir, MODELS_DIR, 'groq.json'), '{}\n');
    r = sourceLib('updater_data_dirty', {}, dir);
    assert.strictEqual(r.status, 0, 'modified provider file must be dirty');
    execFileSync('git', ['checkout', '--', '.'], { cwd: dir });
    execFileSync('git', ['clean', '-qfd', 'web/public'], { cwd: dir });

    // Untracked new provider file → dirty
    fs.writeFileSync(path.join(dir, MODELS_DIR, 'newprovider.json'), '[]\n');
    r = sourceLib('updater_data_dirty', {}, dir);
    assert.strictEqual(r.status, 0, 'untracked provider file must be dirty');
    fs.rmSync(path.join(dir, MODELS_DIR, 'newprovider.json'));

    // Deleted index.json → dirty
    fs.rmSync(path.join(dir, MODELS_DIR, 'index.json'));
    r = sourceLib('updater_data_dirty', {}, dir);
    assert.strictEqual(r.status, 0, 'deleted index.json must be dirty');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('updater_stage_data stages the whole generated set in one go', () => {
  const dir = makeScratchRepo();
  try {
    seedDataFiles(dir);

    // Only some provider files changed
    fs.appendFileSync(path.join(dir, MODELS_DIR, 'groq.json'), '{}\n');
    fs.writeFileSync(path.join(dir, MODELS_DIR, 'google.json'), '[{"id":"gemini"}]\n');
    fs.appendFileSync(path.join(dir, 'web/public/openrouter_free_models.json'), '{}\n');

    sourceLib('updater_stage_data', {}, dir);

    const staged = execFileSync('git', ['diff', '--cached', '--name-only'], {
      cwd: dir,
      encoding: 'utf8',
    }).trim().split('\n').sort();
    assert.deepStrictEqual(staged, [
      'web/public/models/google.json',
      'web/public/models/groq.json',
      'web/public/openrouter_free_models.json',
    ]);

    // Staging a clean set is a no-op success
    execFileSync('git', ['reset', '-q'], { cwd: dir });
    execFileSync('git', ['checkout', '--', '.'], { cwd: dir });
    const clean = spawnSync('bash', ['-c', `set -euo pipefail; source ${JSON.stringify(LIB)}; updater_stage_data`], {
      cwd: dir,
      encoding: 'utf8',
    });
    assert.strictEqual(clean.status, 0, 'staging an unchanged set must not fail');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('engines.node matches across manifests and .nvmrc major', () => {
  const root = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  const web = JSON.parse(fs.readFileSync(path.join(REPO, 'web', 'package.json'), 'utf8'));
  assert.ok(root.engines && root.engines.node, 'root engines.node declared');
  assert.strictEqual(root.engines.node, web.engines.node, 'engine ranges match');
  const nvmrc = fs.readFileSync(path.join(REPO, '.nvmrc'), 'utf8').trim();
  const nvmMajor = parseInt(nvmrc.replace(/^v/, '').split('.')[0], 10);
  const minMajor = parseInt(
    root.engines.node.replace(/^>=\s*v?/, '').split('.')[0],
    10
  );
  assert.ok(nvmMajor >= minMajor, '.nvmrc satisfies engines range');
});

// ── Scratch-clone behaviour tests ────────────────────────────────────────────
function makeScratchRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'updater-test-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'README.md'), 'x\n');
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: dir });
  return dir;
}

test('dirty tree guard aborts without FORCE_UPDATER, proceeds with it', () => {
  const dir = makeScratchRepo();
  try {
    const clean = sourceLib('updater_dirty_tree_guard', {}, dir);
    assert.strictEqual(clean.status, 0, 'clean tree passes guard');

    fs.writeFileSync(path.join(dir, 'local-work.txt'), 'do not lose me\n');
    const dirty = sourceLib('updater_dirty_tree_guard', {}, dir);
    assert.notStrictEqual(dirty.status, 0, 'dirty tree fails guard');
    assert.match(dirty.stderr, /FORCE_UPDATER/);

    const forced = sourceLib('updater_dirty_tree_guard', { FORCE_UPDATER: '1' }, dir);
    assert.strictEqual(forced.status, 0, 'FORCE_UPDATER=1 bypasses guard');
    fs.rmSync(path.join(dir, 'local-work.txt'));

    // cron-owned paths must not trip the guard
    fs.mkdirSync(path.join(dir, 'logs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'logs', 'run.log'), 'log\n');
    const ignoredOk = sourceLib('updater_dirty_tree_guard', {}, dir);
    assert.strictEqual(ignoredOk.status, 0, 'logs/ does not count as dirty');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('node resolution finds node/npm without a pinned install path', () => {
  const r = sourceLib('updater_resolve_node; updater_check_node_version "$(cat .nvmrc)"', {}, REPO);
  assert.strictEqual(r.status, 0, `resolve+check failed: ${r.stderr}`);
  assert.doesNotMatch(r.stderr, /not found/);
});

test('version check rejects node older than the pinned minimum', () => {
  const r = sourceLib(
    'updater_check_node_version 999',
    {},
    REPO
  );
  assert.notStrictEqual(r.status, 0, 'impossible minimum must fail');
  assert.match(r.stderr, /older than required/);
});
