# MEMORY.md

## Identity & preferences
- Name: Myroslav Kravchenko (go by: Myroslav)
- Timezone: Europe/Berlin
- Language preference: Ukrainian
- Formatting preference: use hyphen (-), minimal/no emojis
- Style: be accurate; ask if unsure; avoid guessing
- Brand style: “adidas” always lowercase

## Family
- Wife: Люсі (Lucy) — email: Luisiya@gmail.com
- Address (allowed to store): Karolinenstraße 128, 90763 Fürth

## Email automation (current)
- Gmail push via Cloudflare + Pub/Sub + `gog watch serve` -> local drafter.
- No WhatsApp notifications for auto-drafts.
- Work mailbox auto-draft rules saved in: `memory/work-email-auto-drafter-rules.md`.
- Local drafter service:
  - Code: `services/gmail-drafter/gmail-drafter.js`
  - LaunchAgent: `com.mk.gmail-drafter` (listens on 127.0.0.1:18990, path `/gmail-work`)
  - Watcher: `com.mk.gog.gmail-work-serve` (gog watch serve -> hook-url http://127.0.0.1:18990/gmail-work)
  - Behavior: auto-draft for eligible inbound work emails; reply-to-all mode (preserve CC), no WhatsApp pings.
  - Implementation note: webhook ACKs immediately and processes draft creation asynchronously (background queue) to avoid `gog watch serve` hook timeout ("context canceled").

## Privacy note
- Do not store sensitive personal data (DOB, full address, residence permit details) unless explicitly requested.

## Communication preference
- Prefer very friendly, professional, polite replies; always consider prior thread context.
- Avoid em-dash; use hyphen (-).
- Email wording conventions:
  - Start with "Hi" (not "Hello").
  - End message text with "Kind regards,".

## Email drafting - gog (important)
- Accounts available in gog auth:
  - Work: krmy@ciklum.com
  - Personal: kravch@gmail.com
- Default behavior: when user requests an email reply (thread context provided), create a Gmail draft automatically via `gog` unless they explicitly ask for text-only.
- For work drafts, send-as to use: myroslav.kravchenko@ciklum.com
- Signature rule: message text should be generated without the signature, and the official HTML signature must be appended only when creating/updating the draft via API.
- Formatting rule: keep only one line break between "Kind regards," and the signature HTML.
