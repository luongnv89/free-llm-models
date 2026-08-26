#!/usr/bin/env bash
#
# updater-common.sh
# ─────────────────────────────────────────────────────────────────────────────
# Shared, unit-testable helpers for the openrouter-free-models updater
# scripts. Sourced (never executed) so `test/updater-script.test.js` can
# exercise each function in a scratch clone.
#
# Functions operate on the caller's current working directory (the caller
# `cd`s into the repo first) and print cron-friendly status lines.

set -euo pipefail

# Generated dataset paths committed by the cron updaters: the multi-provider
# outputs (web/public/models/*.json + index.json), the frontend aggregate,
# and the legacy OpenRouter snapshot.
UPDATER_DATA_PATHS=(
  "web/public/models"
  "web/public/free_models.json"
  "web/public/openrouter_free_models.json"
)

# updater_data_paths
# Prints the generated dataset paths, one per line.
updater_data_paths() {
  local p
  for p in "${UPDATER_DATA_PATHS[@]}"; do
    echo "$p"
  done
}

# updater_data_dirty
# Returns 0 when any generated dataset path has staged, unstaged, or untracked
# changes (new provider files may be untracked, so `git status --porcelain`
# is required rather than `git diff --quiet`).
updater_data_dirty() {
  [[ -n "$(git status --porcelain -- "${UPDATER_DATA_PATHS[@]}")" ]]
}

# updater_stage_data
# Stages all generated dataset paths (safe on a no-op: adds nothing when the
# tree is clean).
updater_stage_data() {
  git add -- "${UPDATER_DATA_PATHS[@]}"
}

# updater_assert_clean_tree
# Returns 0 when the working tree has no tracked modifications and no
# untracked files outside the cron-owned paths (logs/, node_modules/, .env).
updater_assert_clean_tree() {
  local status
  status="$(git status --porcelain -- . ':!logs' ':!node_modules' ':!.env' 2>/dev/null)"
  [[ -z "$status" ]]
}

# updater_dirty_tree_guard
# Returns 0 when it is safe to proceed with the hard-reset flow:
#   - clean tree                → proceed silently
#   - dirty tree + FORCE_UPDATER=1 → warn and proceed
#   - dirty tree, no force      → error, return 1 (caller must abort)
updater_dirty_tree_guard() {
  if [[ "${FORCE_UPDATER:-0}" == "1" ]]; then
    if ! updater_assert_clean_tree; then
      echo "[WARN] FORCE_UPDATER=1 set; proceeding despite dirty working tree"
    fi
    return 0
  fi
  if ! updater_assert_clean_tree; then
    echo "[ERROR] Working tree has uncommitted changes." >&2
    echo "[ERROR] Commit/stash them, or re-run with FORCE_UPDATER=1 to allow a hard reset." >&2
    return 1
  fi
}

# updater_resolve_node
# Puts a usable node/npm on PATH without hardcoding any version-managed
# install path: prefers mise shims, falls back to whatever the system offers.
# Returns 1 with a clear message when node or npm cannot be found.
updater_resolve_node() {
  local mise_shims="$HOME/.local/share/mise/shims"
  if [[ -d "$mise_shims" ]]; then
    case ":$PATH:" in
      *":$mise_shims:"*) ;;
      *) export PATH="$mise_shims:$PATH" ;;
    esac
  fi
  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo "[ERROR] node/npm not found on PATH." >&2
    echo "[ERROR] Install Node >= the version pinned in .nvmrc (mise, nvm, or system package)." >&2
    return 1
  fi
}

# updater_check_node_version <min-major>
# Verifies the resolved node satisfies the minimum major version declared in
# .nvmrc / package.json engines. Accepts values like "22", "v22", "22.1.0".
updater_check_node_version() {
  local want="${1:-}"
  if [[ -z "$want" ]]; then
    echo "[WARN] No minimum Node version given; skipping version check"
    return 0
  fi
  want="${want#v}"
  want="${want%%.*}"
  local have
  have="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)" || {
    echo "[ERROR] Could not determine node version" >&2
    return 1
  }
  if (( want > have )); then
    echo "[ERROR] Node $have is older than required major $want (see .nvmrc)" >&2
    return 1
  fi
}
