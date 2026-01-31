#!/bin/bash
set -euo pipefail

# Store secrets from ~/.openclaw/secrets/secrets.env into macOS/iCloud Keychain.
#
# Each secret is stored as a Generic Password:
#   service: openclaw/<KEY>
#   account: mk
#
# This is the reverse operation of scripts/secrets_env_from_keychain.sh

ACCOUNT="mk"
ENV_FILE="$HOME/.openclaw/secrets/secrets.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

# Keep this list in sync with secrets_env_from_keychain.sh
KEYS=(
  OPENCLAW_HOOK_TOKEN
  GMAIL_PERSONAL_PUSH_TOKEN
  GMAIL_WORK_PUSH_TOKEN
  N8N_ENCRYPTION_KEY
  TELEGRAM_BOT_TOKEN
)

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

missing=0
for k in "${KEYS[@]}"; do
  v="${!k-}"
  if [[ -z "$v" ]]; then
    echo "Missing value in $ENV_FILE: $k" >&2
    missing=1
    continue
  fi
  svc="openclaw/$k"
  security add-generic-password -U -s "$svc" -a "$ACCOUNT" -w "$v" >/dev/null
  echo "Stored in Keychain: $k"
done

if [[ $missing -eq 1 ]]; then
  exit 1
fi

echo "Done. You can now re-generate secrets.env via: scripts/secrets_env_from_keychain.sh"
