#!/bin/bash
set -euo pipefail

# Safe OpenClaw gateway restart with an explicit pending list and a post-restart report.
#
# Why: After a gateway restart, it's easy to forget what we were doing.
# This script enforces:
# - write pending items to repo file
# - restart
# - verify health
# - print a short report
# - clear pending file

PENDING_FILE="/Users/mk/clawd/memory/pending-after-restart.md"
LABEL="ai.openclaw.gateway"
UID_NUM="$(id -u)"

PENDING_TEXT="${1:-}"

if [[ -z "$PENDING_TEXT" ]]; then
  cat >&2 <<EOF
Usage: $0 "<what to verify/finish after restart>"

Example:
  $0 "Verify Telegram group config and that gateway is running"
EOF
  exit 2
fi

# 1) write pending
cat > "$PENDING_FILE" <<EOF
# Pending after restart

## Current pending
- $PENDING_TEXT
EOF

# 2) restart
launchctl kickstart -k "gui/${UID_NUM}/${LABEL}" || true

# 3) wait for gateway to be reachable
for i in {1..20}; do
  if openclaw gateway status >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

# 4) report
echo "--- openclaw gateway status ---"
openclaw gateway status || true

echo
echo "--- openclaw channels status --probe ---"
openclaw channels status --probe || true

# 5) clear pending
cat > "$PENDING_FILE" <<'EOF'
# Pending after restart

(Empty)
EOF
