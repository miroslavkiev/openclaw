#!/bin/bash
set -euo pipefail

# Restore OpenClaw runtime config on this machine from repo-friendly sources.
# - Secrets source of truth: macOS/iCloud Keychain
# - Repo-friendly config template: /Users/mk/clawd/config/openclaw.example.json
#
# What it does:
# 1) Generate ~/.openclaw/secrets/secrets.env from Keychain
# 2) Install ~/.openclaw/openclaw.json from the repo template
# 3) (Optional) Restart gateway LaunchAgent

REPO_ROOT="/Users/mk/clawd"
TEMPLATE="$REPO_ROOT/config/openclaw.example.json"
TARGET_CFG="$HOME/.openclaw/openclaw.json"

RESTART=0
FORCE=0

usage() {
  cat <<EOF
Usage: $0 [--restart] [--force]

--restart  Restart the OpenClaw gateway LaunchAgent after writing config.
--force    Overwrite existing ~/.openclaw/openclaw.json (otherwise fails if it exists).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --restart) RESTART=1; shift;;
    --force) FORCE=1; shift;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1;;
  esac
done

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Missing template: $TEMPLATE" >&2
  exit 1
fi

# 1) secrets.env from Keychain
bash "$REPO_ROOT/scripts/secrets_env_from_keychain.sh"

# 2) install openclaw.json
mkdir -p "$(dirname "$TARGET_CFG")"

if [[ -f "$TARGET_CFG" && $FORCE -ne 1 ]]; then
  echo "Refusing to overwrite existing $TARGET_CFG (use --force)." >&2
  exit 1
fi

cp -f "$TEMPLATE" "$TARGET_CFG"
echo "Wrote: $TARGET_CFG"

echo "NOTE: $TARGET_CFG is a template; it uses env placeholders like \${TELEGRAM_BOT_TOKEN}."

echo "Config restore complete."

# 3) optional restart
if [[ $RESTART -eq 1 ]]; then
  echo "Restarting OpenClaw gateway (LaunchAgent ai.openclaw.gateway)..."
  launchctl kickstart -k "gui/$(id -u)/ai.openclaw.gateway"
  echo "Restart requested."
fi
