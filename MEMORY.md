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
- If an LLM result appears empty, prefer investigating parsing/schema issues and logging over generating a fallback email body.
