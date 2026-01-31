# LaunchAgents

This folder contains **source-of-truth** macOS LaunchAgent plist files for this machine.

## Install / Restore

Symlink the desired plist(s) into `~/Library/LaunchAgents/` and load them:

```bash
ln -sf /Users/mk/clawd/launchagents/<file>.plist ~/Library/LaunchAgents/<file>.plist
launchctl unload -w ~/Library/LaunchAgents/<file>.plist >/dev/null 2>&1 || true
launchctl load -w ~/Library/LaunchAgents/<file>.plist
launchctl list | grep <label>
```

## Notes
- Keep scripts in the repo (e.g. `scripts/`), and keep LaunchAgent plists in this folder.
- Avoid editing plists directly in `~/Library/LaunchAgents/` - always edit the repo version.
