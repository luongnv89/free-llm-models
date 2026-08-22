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
#   2. Adds the mise-managed node/npm to PATH (required — node is NOT in
#      ~/.local/bin under cron).
#   3. Hard-resets the repo to origin/main (GitHub is source of truth), then
#      `npm install` (only dep is dotenv).
#   4. Runs `npm run start` → writes web/public/openrouter_free_models.json.
#   5. Commits + pushes the JSON ONLY if it changed.
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

BRANCH="main"
LOG_DIR="$REPO_DIR/logs"
LOCK_FILE="$LOG_DIR/update-free-models.lock"
DATA_FILE="web/public/openrouter_free_models.json"
ENV_CANDIDATES=(
  "$REPO_DIR/.env"
  "${OPENROUTER_ENV_FILE:-}"
  "$HOME/.config/openrouter/api.env"
  "$HOME/.config/devstats/api.env"
)

# ── Toolchain PATH (mise-managed node + gh) ────────────────────────────────────
export PATH="$HOME/.local/share/mise/shims:$HOME/.local/share/mise/installs/node/26.7.0/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"

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

# ── Optional OPENROUTER_API_KEY from env files ──────────────────────────────────
if [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
  for f in "${ENV_CANDIDATES[@]}"; do
    [[ -n "$f" && -f "$f" ]] || continue
    set -a
    # shellcheck disable=SC1090
    source "$f"
    set +a
    if [[ -n "${OPENROUTER_API_KEY:-}" ]]; then
      echo "[AUTH] Loaded OPENROUTER_API_KEY from $f"
      break
    fi
  done
fi
if [[ -n "${OPENROUTER_API_KEY:-}" ]]; then
  echo "[AUTH] Using OPENROUTER_API_KEY"
else
  echo "[AUTH] No OPENROUTER_API_KEY; using public models endpoint"
fi

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

# Treat GitHub as source of truth for this repo
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"
git clean -fd -e logs -e node_modules -e .env

# Install deps (only dependency is dotenv)
if [[ ! -d node_modules ]]; then
  echo "[DEPS] npm install"
  npm install
else
  npm install --silent
fi

npm run start

# Commit + push only if the dataset actually changed
if git diff --quiet -- "$DATA_FILE"; then
  echo "[OK] No data change; nothing to commit."
  exit 0
fi

git add "$DATA_FILE"
git commit -m "chore: daily update openrouter free models"

if ! git push origin "HEAD:${BRANCH}"; then
  echo "[WARN] Push rejected; retrying once against latest $BRANCH"
  git fetch origin
  git reset --hard "origin/${BRANCH}"
  npm run start
  if ! git diff --quiet -- "$DATA_FILE"; then
    git add "$DATA_FILE"
    git commit -m "chore: daily update openrouter free models"
    git push origin "HEAD:${BRANCH}"
  else
    echo "[OK] No changes after retry"
  fi
fi

echo "[OK] Pushed free-models update"
