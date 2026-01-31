# MEMORY.md

## Email drafting (Gmail drafter)
- Do not create reply drafts for Google Calendar notification emails (invites, updates, cancellations). Detect via sender (calendar@google.com / calendar-notification@google.com) and common subject/snippet markers like "Invitation:", "Updated invitation:", "Cancelled/Canceled event" and "Invitation from Google Calendar".
- Draft requirements:
  - Always draft as Reply-To-All: include original To recipients (excluding my own addresses) plus the sender in To, and keep original Cc (excluding my own) in Cc.
  - Formatting:
    - Render bullet lines ("- item" or "* item") as real HTML lists (<ul><li>), not plain text.
    - Always include the closing line `Kind regards,` immediately before the appended HTML signature (the model output should not contain the signature).
    - There must be exactly one blank line before `Kind regards,`.
    - After `Kind regards,` there must be exactly one line break before the signature (no extra blank line).
    - Include quoted previous message content at the bottom (Gmail-like quote block) when replying.
    - Note: quoted blocks may behave differently in Gmail. Prefer keeping <img> tags in quoted HTML; Gmail may still hide them depending on how the original message referenced attachments/inline content.
- If an LLM result appears empty, prefer investigating parsing/schema issues and logging over generating a fallback email body.
- Gmail drafter reliability:
  - Retry draft creation a few times with backoff on failures.
  - On failure, apply a `draft_failed` label and append a JSONL error record to `logs/gmail-drafter-errors.jsonl`.

## Dual GOG Gmail watch (work + personal)
- We run two parallel `gog gmail watch serve` instances (Pub/Sub push receivers):
  - personal: 127.0.0.1:8788 (gmail-personal.kravchen.com)
  - work: 127.0.0.1:8789 (gmail-work.kravchen.com)
- Managed via macOS LaunchAgents:
  - com.mk.gog.gmail-personal-serve (+ renew)
  - com.mk.gog.gmail-work-serve (+ renew)
  - com.mk.gmail-drafter (work drafts) on 127.0.0.1:18990/gmail-work
- Full operational details: memory/gog-dual-gmail-watch-setup.md (includes Cloudflare Tunnel hostnames/endpoints + double NAT note)

## Shopping list file (persistent)
- Canonical shopping list file in workspace: `/Users/mk/clawd/shopping-list.md`.
- Default behavior: when Myroslav asks to add/remove/show items for “shopping list / список покупок” without specifying another note/list, update this file.

## Shopping list auto-readd (weekly staples)
- Requirement: every Saturday at 10:00 (Europe/Berlin), ensure these items exist in `shopping-list.md` even if removed during the week:
  - червона риба солона
  - авокадо
- Implementation: macOS LaunchAgent (launchd), not Home Assistant.
  - Script: `/Users/mk/clawd/scripts/shopping_list_weekly_staples.py`
  - LaunchAgent plist (source of truth in repo): `/Users/mk/clawd/launchagents/ai.openclaw.shopping-list-weekly-staples.plist`
  - Installed via symlink to: `~/Library/LaunchAgents/ai.openclaw.shopping-list-weekly-staples.plist`
  - Logs: `/tmp/openclaw-shopping-list-weekly-staples.out.log` and `.err.log`

## Default operational approach: scripts + LaunchAgents + secrets
- Default for future automations on this machine:
  - Put scripts in the repo under `/Users/mk/clawd/scripts/`.
  - Put LaunchAgent plists in the repo under `/Users/mk/clawd/launchagents/`.
  - Install via symlink into `~/Library/LaunchAgents/` (never edit files directly there).
  - Keep secrets OUT of git:
    - Source of truth: iCloud Keychain.
    - Runtime: generate `~/.openclaw/secrets/secrets.env` (chmod 600) from Keychain.
    - Use env placeholders (`${ENV_VAR}`) inside repo-friendly configs.
  - Use `launchagents/install.sh` to (re)install/restore.

## Keychain-backed secrets.env
- `scripts/secrets_env_from_keychain.sh` generates `~/.openclaw/secrets/secrets.env` from iCloud Keychain.
- `scripts/secrets_keychain_from_env.sh` stores secrets from `secrets.env` into Keychain.
- Convention: Generic Password entries with:
  - service: `openclaw/<ENV_KEY>`
  - account: `mk`

## Home Assistant voice intent mapping (bathroom mirror)
- When Myroslav says “увімкни/вимкни світло в ванні/ванній” (bathroom), control this HA entity:
  - `switch.bath_mirror_switch_switch_1`
  - ON: `switch.turn_on`
  - OFF: `switch.turn_off`
- Note: this was confirmed to work; the older `automation.turn_bath_mirror_*` may not actually affect the physical switch.

## Telegram (OpenClaw) setup
- Telegram bot enabled via `channels.telegram`.
- Bot: `@mkravch_bot`.
- DM policy: `allowlist` with allowed user_id: `402628226`.
- Group policy: `allowlist` with explicit group chat IDs:
  - `-1003898983945` ("Батьки і ШІ")
  - `-5047651066` ("Люся та ШІ")
- Group behavior: `requireMention=false` (respond to all group messages).
- Note: If Telegram BotFather privacy mode is ON, unmentioned messages can be blocked. Set `/setprivacy` → Disable and re-add bot to group.
- Secrets handling note:
  - Source of truth: iCloud Keychain (`openclaw/TELEGRAM_BOT_TOKEN`, account `mk`).
  - Runtime env file: `~/.openclaw/secrets/secrets.env` (generated from Keychain).
  - OpenClaw config should reference it as `${TELEGRAM_BOT_TOKEN}` in `~/.openclaw/openclaw.json`.

## Restart safety (important)
- Before triggering any restart (gateway restart / config apply / updates):
  - Write what is still unfinished to `memory/pending-after-restart.md`.
- After restart:
  - Check `memory/pending-after-restart.md`, finish the remaining items, then clear/update the file and report.

## Gmail watcher layout
- Personal Gmail watch should be run by **OpenClaw gateway** (built-in gmail watcher) when `hooks.gmail` is configured.
- Do NOT run a separate LaunchAgent on 8788 for personal watcher; it causes port conflicts.
- Work Gmail watch is run as separate LaunchAgents and posts to `gmail-drafter` on 18990.

## Google Chat (OpenClaw) setup via Cloudflare Tunnel
- Plugin: bundled `@openclaw/googlechat` (enable via `openclaw plugins enable googlechat`).
- Cloudflare Tunnel service runs as root LaunchDaemon `system/com.cloudflare.cloudflared` and reads config from `/etc/cloudflared/config.yml` (not `/opt/homebrew/etc/cloudflared/config.yml`).
- Ingress mapping:
  - `googlechat.kravchen.com` -> `http://localhost:18789` (OpenClaw gateway).
  - Webhook path: `/googlechat`.
- OpenClaw config (single account): `channels.googlechat`:
  - `serviceAccountFile`: `/Users/mk/.openclaw/credentials/service_account_googlechat.json`
  - `audienceType`: `app-url`
  - `audience`: `https://googlechat.kravchen.com/googlechat`
  - `webhookPath`: `/googlechat`
  - DM policy: normally `allowlist` (temporarily used `open` for debugging).
- GCP:
  - Project: `noble-catcher-485620-a5`.
  - Service account created for OpenClaw Chat: `openclaw-googlechat@noble-catcher-485620-a5.iam.gserviceaccount.com`.
  - Key file: `/Users/mk/.openclaw/credentials/service_account_googlechat.json`.
  - After configuring Chat API app in Google Cloud Console, `openclaw channels status --probe` reports Google Chat: `works`.
- Validation checks:
  - `openclaw channels status --probe` should show Google Chat `works`.
  - `curl -i -X POST https://googlechat.kravchen.com/googlechat ...` should return `400` for dummy payload (means routing OK).
- Restarts:
  - Cloudflare tunnel: `sudo launchctl kickstart -k system/com.cloudflare.cloudflared`
  - OpenClaw gateway (LaunchAgent): `launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway`
