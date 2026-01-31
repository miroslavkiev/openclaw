# LaunchAgents (source of truth)

We keep LaunchAgent plist files **in the repo** and install them via symlink into `~/Library/LaunchAgents/`.

## Secrets

Secrets are **NOT** committed.

Place them here:
- `~/.openclaw/secrets/secrets.env`

Format: bash-compatible `KEY=VALUE` lines.

Template:
- `launchagents/secrets.env.example`

## Gmail watchers note
- Personal Gmail watch (8788 -> OpenClaw) is run by **OpenClaw gateway** via `hooks.gmail`.
- Work Gmail watch is run as separate LaunchAgents (`com.mk.gog.gmail-work-serve` + renew) and posts to `gmail-drafter`.

Recommended:
- `chmod 600 ~/.openclaw/secrets/secrets.env`

## Install / restore

```bash
# 1) Put secrets into Keychain (recommended) or create secrets.env manually.
mkdir -p ~/.openclaw/secrets

# Optional: start from the template
cp /Users/mk/clawd/launchagents/secrets.env.example ~/.openclaw/secrets/secrets.env
chmod 600 ~/.openclaw/secrets/secrets.env

# 2) Install/restore LaunchAgents
bash /Users/mk/clawd/launchagents/install.sh
```

## Keychain-backed secrets (recommended)

We can regenerate `~/.openclaw/secrets/secrets.env` from macOS/iCloud Keychain.

Convention:
- Keychain item type: **Generic Password**
- service: `openclaw/<ENV_KEY>`
- account: `mk`

Examples (run once per secret):

```bash
security add-generic-password -U -s 'openclaw/OPENCLAW_HOOK_TOKEN' -a 'mk' -w '...'
security add-generic-password -U -s 'openclaw/GMAIL_PERSONAL_PUSH_TOKEN' -a 'mk' -w '...'
security add-generic-password -U -s 'openclaw/GMAIL_WORK_PUSH_TOKEN' -a 'mk' -w '...'
security add-generic-password -U -s 'openclaw/N8N_ENCRYPTION_KEY' -a 'mk' -w '...'

# regenerate ~/.openclaw/secrets/secrets.env
bash /Users/mk/clawd/scripts/secrets_env_from_keychain.sh

# If you really want to overwrite an existing secrets.env even when some Keychain
# items are missing:
# bash /Users/mk/clawd/scripts/secrets_env_from_keychain.sh --force
```

## Notes
- Do NOT edit plists directly in `~/Library/LaunchAgents/` - always edit the repo versions.
- Keep `~/.openclaw/secrets/secrets.env` out of git (chmod 600).
