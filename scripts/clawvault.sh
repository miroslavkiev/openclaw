#!/bin/zsh
set -euo pipefail

# Ensure bun global binaries (e.g., qmd) are available even in non-interactive shells.
export PATH="$HOME/.bun/bin:$PATH"

exec /opt/homebrew/bin/clawvault "$@"
