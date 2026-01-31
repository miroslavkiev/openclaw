#!/bin/bash
set -euo pipefail

REPO_ROOT="/Users/mk/clawd"
SRC_DIR="$REPO_ROOT/launchagents"
DST_DIR="$HOME/Library/LaunchAgents"

mkdir -p "$DST_DIR"

plists=(
  ai.openclaw.gateway.plist
  ai.openclaw.shopping-list-weekly-staples.plist
  com.mk.gmail-drafter.plist
  com.mk.gog.gmail-personal-serve.plist
  com.mk.gog.gmail-personal-renew.plist
  com.mk.gog.gmail-work-serve.plist
  com.mk.gog.gmail-work-renew.plist
  com.mk.n8n.plist
)

for p in "${plists[@]}"; do
  src="$SRC_DIR/$p"
  dst="$DST_DIR/$p"

  if [[ ! -f "$src" ]]; then
    echo "Missing $src" >&2
    exit 1
  fi

  # If an existing real file is present, back it up once.
  if [[ -e "$dst" && ! -L "$dst" ]]; then
    mv "$dst" "$dst.bak.$(date +%s)"
  fi

  ln -sf "$src" "$dst"

  launchctl unload -w "$dst" >/dev/null 2>&1 || true
  launchctl load -w "$dst"
  echo "Loaded: $p"

done

echo "Done. If something doesn't start, check logs under ~/Library/Logs or /tmp/*.err.log" 
