const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..');
const UPDATER = path.join(REPO, 'scripts', 'openrouter-free-models-update.sh');
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
