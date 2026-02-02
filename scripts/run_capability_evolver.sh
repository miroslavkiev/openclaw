#!/bin/zsh
set -euo pipefail

cd /Users/mk/clawd

# Run the capability evolver (prints the evolution prompt / diagnostics)
/opt/homebrew/bin/node skills/capability-evolver/index.js
