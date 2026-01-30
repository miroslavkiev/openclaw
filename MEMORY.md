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
