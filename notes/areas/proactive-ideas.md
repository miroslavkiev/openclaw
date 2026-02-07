# Proactive ideas

Capture ideas for things the agent could do proactively (drafts, automations, check-ins).

## Inbox
- Add a small heartbeat helper to summarize the last ~50 lines of `/tmp/openclaw/openclaw-YYYY-MM-DD.log` (errors/warnings only) into today’s `memory/YYYY-MM-DD.md`.
- Detect repeated WhatsApp gateway flaps (status 428/503 disconnect → reconnect) and: (a) log them to today’s memory file, (b) if flapping persists (e.g., >3 times/hour), notify Myroslav with a short diagnostic suggestion (relink QR, check network).
- Add a simple “channels status probe” on heartbeat (no external messages) and write only changes (e.g., WhatsApp disconnected) into `memory/YYYY-MM-DD.md`.
- Track WhatsApp flap frequency with a rolling window (e.g., last 60 minutes) and only notify if threshold exceeded; otherwise just log (avoids noisy pings).
- When 428 flaps happen, capture a quick diagnostic bundle into memory: current gateway uptime, last reconnect time, and `openclaw channels status --probe` output (diffed vs previous).

## Shortlist (approve/implement)
- Add a note/tooling reminder: `web_fetch` only supports http(s); use `read`/`exec` for local files like `/tmp/openclaw/*.log`.
- Add an “auto-triage” snippet for WhatsApp flaps: if we see 428/503 more than N times/day, collect `openclaw status` + `openclaw channels status --probe` and write a concise incident note into today’s memory file.
- Add a lightweight watchdog for WhatsApp session health: if disconnects happen repeatedly overnight, schedule a morning reminder to Myroslav with count + suggested actions (network check, relink QR) - but only if threshold exceeded.
- Detect repeated `gmail-watcher` oauth2 `invalid_grant` and (a) log it once/day to `memory/YYYY-MM-DD.md`, (b) notify Myroslav once with the likely fix: re-auth/refresh gog credentials for the affected account.

## Implemented
