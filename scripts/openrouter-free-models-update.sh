#!/usr/bin/env bash
#
# openrouter-free-models-update.sh
# ─────────────────────────────────────────────────────────────────────────────
# Daily OpenRouter free-models updater.
#
# This is the entry point referenced by the Hermes cron job
# `openrouter-free-models-daily` (script: "openrouter-free-models-update.sh",
# resolved from ~/.hermes/scripts/). It is symlinked there from this repo so the
# two stay in sync.
#
# What it does:
#   1. Locks itself with flock (no overlapping runs).
#   2. Resolves node/npm dynamically (mise shims preferred — no hardcoded
#      version paths) and verifies the version satisfies .nvmrc.
#   3. Refuses to run on a dirty working tree unless FORCE_UPDATER=1 is set
#      (guards against destroying local work if invoked manually).
#   4. Hard-resets the repo to origin/main (GitHub is source of truth) and
#      cleans untracked files EXCEPT logs/, node_modules/, .env — then
#      `npm ci` (lockfile-driven; fails fast on manifest/lockfile mismatch).
#   5. Runs `npm run start` → writes web/public/models/*.json + index.json
#      plus the legacy web/public/openrouter_free_models.json.
#   6. Commits + pushes ONLY if any generated file changed.
#
# Escape hatch: FORCE_UPDATER=1 bypasses the dirty-tree guard (the reset in
# step 4 will still discard local changes outside logs/, node_modules/, .env).
#
# Everything written to stdout becomes the Telegram message the cron delivers.

set -euo pipefail

# ── Locate this script (follow symlink so it works from ~/.hermes/scripts) ──────
SRC="${BASH_SOURCE[0]}"
if [[ -L "$SRC" ]]; then
  SRC="$(readlink -f "$SRC")"
fi
SCRIPT_DIR="$(cd "$(dirname "$SRC")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=scripts/lib/updater-common.sh
source "$SCRIPT_DIR/lib/updater-common.sh"

BRANCH="main"
LOG_DIR="$REPO_DIR/logs"
LOCK_FILE="$LOG_DIR/update-free-models.lock"
ENV_CANDIDATES=(
  "$REPO_DIR/.env"
  "${OPENROUTER_ENV_FILE:-}"
  "$HOME/.config/openrouter/api.env"
  "$HOME/.config/devstats/api.env"
)

# Provider API keys the multi-provider runner consumes (PROVIDERS and
# PROVIDER_TIMEOUT_MS are read straight from the environment by node).
PROVIDER_KEY_VARS=(OPENROUTER_API_KEY GROQ_API_KEY GOOGLE_AI_API_KEY)

# True when every provider key var is already set (possibly empty).
all_provider_keys_set() {
  local v
  for v in "${PROVIDER_KEY_VARS[@]}"; do
    [[ -n "${!v:-}" ]] || return 1
  done
}

# ── SSH auth for push (use the deploy key if present) ───────────────────────────
if [[ -z "${GIT_SSH_COMMAND:-}" ]]; then
  if [[ -f "$HOME/.ssh/blogs_deploy" ]]; then
    export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/blogs_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
  else
    export GIT_SSH_COMMAND="ssh -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
  fi
fi

# ── Single-instance lock ────────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[SKIP] Another openrouter free-models update is already in progress"
  exit 0
fi

# ── Optional provider API keys from env files ───────────────────────────────
# Source candidate env files until every provider key is defined; keys absent
# everywhere simply fall back to the adapters' public/no-key behaviour.
if ! all_provider_keys_set; then
  for f in "${ENV_CANDIDATES[@]}"; do
    [[ -n "$f" && -f "$f" ]] || continue
    set -a
    # shellcheck disable=SC1090
    source "$f"
    set +a
    all_provider_keys_set && break
  done
fi
for v in "${PROVIDER_KEY_VARS[@]}"; do
  if [[ -n "${!v:-}" ]]; then
    echo "[AUTH] Using $v"
  else
    echo "[AUTH] No $v; using keyless endpoint where applicable"
  fi
done

echo "[REPO] $REPO_DIR (branch $BRANCH)"
cd "$REPO_DIR"

# Git identity for cron commits if missing
if ! git config user.email >/dev/null 2>&1; then
  name="$(git log -1 --format='%an' 2>/dev/null || echo 'Luong NGUYEN')"
  email="$(git log -1 --format='%ae' 2>/dev/null || echo 'luongnv89@users.noreply.github.com')"
  git config user.name "$name"
  git config user.email "$email"
fi

# Recover from any stale in-progress git state
git rebase --abort >/dev/null 2>&1 || true
git merge --abort  >/dev/null 2>&1 || true

# ── Dirty-tree guard (#12): never destroy local work unless forced ──────────────
if ! updater_dirty_tree_guard; then
  exit 1
fi

# Treat GitHub as source of truth for this repo
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"
git clean -fd -e logs -e node_modules -e .env

# ── Node runtime resolution (#14): no hardcoded install path ────────────────────
updater_resolve_node
updater_check_node_version "$(cat "$REPO_DIR/.nvmrc")"

# Install deps from the lockfile (fails fast on package.json/lockfile mismatch)
echo "[DEPS] npm ci"
npm ci --silent

npm run start

# Commit + push only if the generated dataset actually changed
if ! updater_data_dirty; then
  echo "[OK] No data change; nothing to commit."
  exit 0
fi

updater_stage_data
git commit -m "chore: daily update openrouter free models"

if ! git push origin "HEAD:${BRANCH}"; then
  echo "[WARN] Push rejected; retrying once against latest $BRANCH"
  git fetch origin
  git reset --hard "origin/${BRANCH}"
  updater_resolve_node
  npm run start
  if updater_data_dirty; then
    updater_stage_data
    git commit -m "chore: daily update openrouter free models"
    git push origin "HEAD:${BRANCH}"
  else
    echo "[OK] No changes after retry"
  fi
fi

echo "[OK] Pushed free-models update"
