#!/usr/bin/env bash
# Regenerate free-llm-models dataset and push the updated model JSON to main.
# Run by the Hermes cron job. Committed to the repo so it survives `git clean`.
set -euo pipefail

REPO="/home/omachi/workspace/free-llm-models"
cd "$REPO"

branch="$(git rev-parse --abbrev-ref HEAD)"

# Pull latest so the push never diverges.
git fetch origin 2>&1 | tail -1
git pull --rebase origin "$branch" 2>&1 | tail -1

# Regenerate web/public/models/*.json (+ index.json, free_models.json, legacy snapshot).
node get_openrouter_free_models.js 2>&1 | tail -20

# Stage only the generated model data (edits + deletions), per repo AGENTS.md.
git add -A web/public/models web/public/free_models.json web/public/openrouter_free_models.json

if git diff --cached --quiet; then
  echo "No model-data changes — nothing to commit."
else
  stamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  git commit -m "chore(models): nightly update $stamp" 2>&1 | tail -2
  git push origin "$branch" 2>&1 | tail -2
  echo "Pushed model-data update."
fi
