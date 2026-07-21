#!/usr/bin/env bash
set -euo pipefail

# Install a user crontab entry for daily OpenRouter free-models updates.
# Default: 03:00 UTC (portfolio stats cron uses 01:00 UTC).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CRON_SCHEDULE=${CRON_SCHEDULE:-"0 3 * * *"}
LOG_DIR="$REPO_DIR/logs"
CMD="${REPO_DIR}/scripts/update_data.sh >> ${LOG_DIR}/update-free-models.log 2>&1"
MARKER="openrouter-free-models/scripts/update_data.sh"

mkdir -p "$LOG_DIR"

TMP=$(mktemp)
crontab -l 2>/dev/null | grep -vF "$MARKER" > "$TMP" || true
echo "${CRON_SCHEDULE} ${CMD}" >> "$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "[OK] Installed cron: ${CRON_SCHEDULE} ${CMD}"
crontab -l | grep -F "$MARKER" || true
