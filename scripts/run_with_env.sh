#!/bin/bash
set -euo pipefail

# Usage:
#   run_with_env.sh /path/to/secrets.env -- <command> [args...]
#
# The secrets.env is a bash-compatible KEY=VALUE file.

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 /path/to/secrets.env -- <command> [args...]" >&2
  exit 2
fi

SECRETS_FILE="$1"
shift

if [[ "$1" != "--" ]]; then
  echo "Expected -- after secrets file" >&2
  exit 2
fi
shift

if [[ -f "$SECRETS_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "$SECRETS_FILE"
  set +a
fi

exec "$@"
