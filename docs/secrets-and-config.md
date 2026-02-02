# Secrets + repo-friendly config (mk)

## Goals
- Keep **secrets out of git**.
- Keep **restorable config** in the repo.
- Source of truth for secrets: **macOS/iCloud Keychain**.
- Runtime secrets file: `~/.openclaw/secrets/secrets.env` (generated from Keychain).

## Keychain convention
Each secret is a *Generic Password* entry:
- service: `openclaw/<ENV_KEY>`
- account: `mk`
- password: `<value>`

Example:
```bash
security add-generic-password -U -s 'openclaw/TELEGRAM_BOT_TOKEN' -a 'mk' -w '...'
```

## Generate secrets.env from Keychain
```bash
bash /Users/mk/clawd/scripts/secrets_env_from_keychain.sh
```

## Store secrets.env into Keychain (reverse)
```bash
bash /Users/mk/clawd/scripts/secrets_keychain_from_env.sh
```

## OpenClaw config
- Source of truth in repo: `config/openclaw.example.json`
- Real runtime file (NOT in repo): `~/.openclaw/openclaw.json`

The example config references secrets via env vars like `${TELEGRAM_BOT_TOKEN}`.

Recommended flow:
1) Ensure secrets are in Keychain.
2) Generate `~/.openclaw/secrets/secrets.env` from Keychain.
3) Create/maintain `~/.openclaw/openclaw.json` based on the example config (keeping secrets as `${ENV_VAR}` placeholders).
