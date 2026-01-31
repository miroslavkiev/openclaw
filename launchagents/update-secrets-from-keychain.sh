#!/bin/bash
set -euo pipefail

# Convenience wrapper.
# Rebuild ~/.openclaw/secrets/secrets.env from Keychain.

exec /Users/mk/clawd/scripts/secrets_env_from_keychain.sh
