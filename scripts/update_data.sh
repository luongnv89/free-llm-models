#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/luongnv/workspace/openrouter-free-models"
cd "$REPO_DIR"

# Ensure we can pull/push via the deploy key used for this repo.
export GIT_SSH_COMMAND="ssh -i /home/luongnv/.ssh/blogs_deploy -o IdentitiesOnly=yes"

# Pull latest
git pull --ff-only

# Install deps (fast if already installed)
npm install --silent

# Fetch latest free models (writes web/public/openrouter_free_models.json)
npm run start

# Commit only if data changed
if git diff --quiet -- web/public/openrouter_free_models.json; then
  echo "No data change; nothing to commit."
  exit 0
fi

git add web/public/openrouter_free_models.json

git commit -m "chore: daily update openrouter free models" || true

git push origin HEAD
