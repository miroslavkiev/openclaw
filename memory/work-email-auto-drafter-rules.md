# Work email auto-drafter rules (krmy@ciklum.com / myroslav.kravchenko@ciklum.com)

Source: user message (2026-01-29). This is the desired end-state behavior for the local Gmail auto-drafter.

## Trigger
1) New inbound email arrives.
2) Flow: Gmail push -> `gog watch serve` -> local drafter.
3) No WhatsApp notifications.

## Eligibility filter (when to auto-draft)
- Sender domain: `@ciklum.com` or `@adidas.com`.
- Addressed to: `krmy@ciklum.com` or `myroslav.kravchenko@ciklum.com`.
- Exclude broadcast / mass mail if any of:
  - (To + CC + BCC) >= 8
  - `List-Unsubscribe` header present
  - recipient contains `undisclosed`
  - subject/body markers like `digest` / `newsletter` (and similar)

## Draft generation steps
1) Fetch latest message + thread context (last 3-8 messages) via `gog gmail thread get --full`.
2) Extract recipient display name from the From header.
3) Detect inbound language (en/de/uk) and generate reply in the same language.
4) Generate reply via `clawdbot agent --json` (no `--deliver`), using prompt:
   - short, friendly, professional
   - use thread context
   - do not use em-dash (only hyphen '-')
   - pass the full display name and instruct the LLM to extract the first name for greeting: `Hi <first name>,` (fallback: `Hi,`)
- Important: the webhook handler must ACK fast. Draft creation (thread fetch + LLM) runs async in background to avoid `gog watch serve` hook timeouts ("context canceled").
- Draft body should include the quoted previous email below the signature (gmail_quote block), similar to Gmail Reply All UI.
- Important: to preserve Outlook HTML tables in quote, extract HTML part via `gog gmail get --format full` and sanitize (strip head/style/script/meta/link, keep body inner HTML). `--format raw` does not include payload parts, so HTML quote will be empty.
5) Signature handling:
   - Fetch work HTML signature via `gog gmail settings sendas get myroslav.kravchenko@ciklum.com --json`.
   - Append signature to the draft HTML with one normal gap (no dividers).
6) Create HTML draft:
   - `gog gmail drafts create --body-html ... --from myroslav.kravchenko@ciklum.com --reply-to-message-id <id>`

## Notes
- The agent should return text in JSON only; no WhatsApp alerts.
- The drafted email body should not include the signature; signature is appended only at API stage.
