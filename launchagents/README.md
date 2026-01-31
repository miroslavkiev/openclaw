# LaunchAgents (source of truth)

We keep LaunchAgent plist files **in the repo** and install them via symlink into `~/Library/LaunchAgents/`.

## Secrets

Secrets are **NOT** committed.

Place them here:
- `~/.openclaw/secrets/secrets.env`

Format: bash-compatible `KEY=VALUE` lines.

Template:
- `launchagents/secrets.env.example`

Recommended:
- `chmod 600 ~/.openclaw/secrets/secrets.env`

## Install / restore

```bash
mkdir -p ~/.openclaw/secrets
cp /Users/mk/clawd/launchagents/secrets.env.example ~/.openclaw/secrets/secrets.env
chmod 600 ~/.openclaw/secrets/secrets.env

bash /Users/mk/clawd/launchagents/install.sh
```

## Notes
- Prefer storing secrets in iCloud Keychain, then (re)populate `~/.openclaw/secrets/secrets.env` from there.
- Do NOT edit plists directly in `~/Library/LaunchAgents/` - always edit the repo versions.
