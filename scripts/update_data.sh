#!/usr/bin/env bash
set -euo pipefail

# End-to-end daily updater for OpenRouter free-models dataset.
# pull → fetch free models → commit JSON if changed → push main
#
# Hardened for cron:
# - repo-relative paths (works on any host user)
# - flock to prevent overlapping runs
# - default SSH identity (optional blogs_deploy key)
# - optional OPENROUTER_API_KEY from env or ~/.config/openrouter/api.env

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$REPO_DIR/logs"
LOCK_FILE="$LOG_DIR/update-free-models.lock"
ENV_CANDIDATES=(
  "$REPO_DIR/.env"
  "${OPENROUTER_ENV_FILE:-}"
  "$HOME/.config/openrouter/api.env"
  "$HOME/.config/devstats/api.env"
)

mkdir -p "$LOG_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[SKIP] Another openrouter free-models update is already in progress"
  exit 0
fi

export PATH="${HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"

if [[ -n "${GIT_SSH_COMMAND:-}" ]]; then
  :
elif [[ -f "${HOME}/.ssh/blogs_deploy" ]]; then
  export GIT_SSH_COMMAND="ssh -i ${HOME}/.ssh/blogs_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
else
  export GIT_SSH_COMMAND="ssh -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
fi

# Load first available env file that defines OPENROUTER_API_KEY (optional).
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

echo "[REPO] $REPO_DIR"
cd "$REPO_DIR"

# Git identity for cron commits if missing
if ! git config user.email >/dev/null 2>&1; then
  name="$(git log -1 --format='%an' 2>/dev/null || echo 'Luong NGUYEN')"
  email="$(git log -1 --format='%ae' 2>/dev/null || echo 'luongnv89@users.noreply.github.com')"
  git config user.name "$name"
  git config user.email "$email"
fi

(git rebase --abort >/dev/null 2>&1 || true)
(git merge --abort >/dev/null 2>&1 || true)

git fetch origin
git checkout main
git reset --hard origin/main
git clean -fd -e logs -e node_modules -e .env

if [[ ! -d node_modules ]]; then
  echo "[DEPS] npm install"
  npm ci || npm install
else
  npm install --silent
fi

npm run start

if git diff --quiet -- web/public/openrouter_free_models.json; then
  echo "[OK] No data change; nothing to commit."
  exit 0
fi

git add web/public/openrouter_free_models.json
git commit -m "chore: daily update openrouter free models"

if ! git push origin HEAD:main; then
  echo "[WARN] Push rejected; retrying once against latest main"
  git fetch origin
  git reset --hard origin/main
  npm run start
  if ! git diff --quiet -- web/public/openrouter_free_models.json; then
    git add web/public/openrouter_free_models.json
    git commit -m "chore: daily update openrouter free models"
    git push origin HEAD:main
  else
    echo "[OK] No changes after retry"
  fi
fi

echo "[OK] Pushed free-models update"
