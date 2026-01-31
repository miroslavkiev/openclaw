#!/bin/bash
set -euo pipefail

# Generate ~/.openclaw/secrets/secrets.env from macOS/iCloud Keychain.
#
# We store each secret as a Generic Password entry:
#   service: openclaw/<KEY>
#   account: mk
#   password: <VALUE>
#
# Example:
#   security add-generic-password -U -s 'openclaw/OPENCLAW_HOOK_TOKEN' -a 'mk' -w '...'
#
# Safety:
# - By default, this script will NOT overwrite an existing secrets.env if any required
#   Keychain entries are missing (to avoid breaking running services).
# - Use --force to overwrite anyway.

ACCOUNT="mk"
OUT_DIR="$HOME/.openclaw/secrets"
OUT_FILE="$OUT_DIR/secrets.env"
FORCE=0

if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
fi

KEYS=(
  OPENCLAW_HOOK_TOKEN
  GMAIL_PERSONAL_PUSH_TOKEN
  GMAIL_WORK_PUSH_TOKEN
  N8N_ENCRYPTION_KEY
  TELEGRAM_BOT_TOKEN
  BRAVE_API_KEY
  HA_TOKEN
  OPENCLAW_GATEWAY_PASSWORD
)

mkdir -p "$OUT_DIR"

missing=0
vals=()
for k in "${KEYS[@]}"; do
  svc="openclaw/$k"
  val="$(security find-generic-password -s "$svc" -a "$ACCOUNT" -w 2>/dev/null || true)"
  if [[ -z "$val" ]]; then
    echo "Missing in Keychain: $k (service '$svc', account '$ACCOUNT')" >&2
    missing=1
  fi
  vals+=("$val")
done

if [[ $missing -eq 1 && $FORCE -ne 1 && -f "$OUT_FILE" ]]; then
  echo "Refusing to overwrite existing $OUT_FILE because some Keychain entries are missing." >&2
  echo "Add the missing Keychain items first, or re-run with --force." >&2
  exit 1
fi

umask 077
TMP_FILE="$OUT_FILE.tmp.$$"
{
  echo "# Generated from Keychain: $(date -Iseconds)"
  echo "# Do not edit manually. Source of truth: macOS/iCloud Keychain."
  echo
  for i in "${!KEYS[@]}"; do
    k="${KEYS[$i]}"
    v="${vals[$i]}"
    esc="${v//$'\n'/}"
    echo "$k=$esc"
  done
} > "$TMP_FILE"

chmod 600 "$TMP_FILE"
mv "$TMP_FILE" "$OUT_FILE"

echo "Wrote: $OUT_FILE"
