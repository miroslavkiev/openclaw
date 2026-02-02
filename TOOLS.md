# TOOLS.md - Local Notes

Skills define *how* tools work. This file is for *your* specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:
- Camera names and locations
- SSH hosts and aliases  
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras
- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH
- home-server → 192.168.1.100, user: admin

### TTS
- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

### Gmail drafts (gog) - accounts + signature
- `gog` binary: `/opt/homebrew/bin/gog` (Homebrew)
- gog config file: `~/Library/Application Support/gogcli/config.json`
- Accounts:
  - Work Gmail account (API): `krmy@ciklum.com`
    - Default send-as: `myroslav.kravchenko@ciklum.com`
    - Default gog `--client`: `work`
  - Personal Gmail account (API): `kravch@gmail.com`
    - Default gog `--client`: `personal`
- Default behavior (important):
  - When you paste an inbound email thread and ask for a reply, I should create a Gmail draft automatically via `gog gmail drafts create/update` (not just output text).
  - Exceptions: if required info is missing, I ask 1-2 clarifying questions first; if you explicitly request “text only”, I will not create a draft.
- Signature handling rule (important):
  - LLM-generated message body must NOT include the signature.
  - Add the official HTML signature only at the API request stage by appending it to `--body-html`.
  - Signature source:
    - `gog --account krmy@ciklum.com gmail settings sendas get myroslav.kravchenko@ciklum.com --json`
    - JSON path: `.sendAs.signature` (HTML)
- Closing preference:
  - End message text with `Kind regards,` immediately followed by the signature (only one line break between them).
  - Start emails with `Hi ...` (not `Hello`).


### Coding agents
- OpenCode CLI:
  - Install: `npm i -g opencode-ai@latest`
  - Binary: `/opt/homebrew/bin/opencode`
  - Non-interactive run:
    - `opencode run "<task>"`

### Writing hygiene (humanizer)
- Skill: `skills/humanizer/` (ClawdHub)
- Use when rewriting text to sound more natural/human-written (remove AI-writing patterns).
- Notes:
  - Avoid em dashes (—); prefer hyphen (-) for Myroslav.
  - Keep Ukrainian output when requested.

### YouTube transcripts (youtube-watcher)
- Skill: `skills/youtube-watcher/` (ClawdHub)
- Prereq: `yt-dlp` installed (Homebrew): `/opt/homebrew/bin/yt-dlp`
- Usage:
  - `python3 /Users/mk/clawd/skills/youtube-watcher/scripts/get_transcript.py "<youtube-url>"`
  - Works when the video has captions/auto-subs.

### ClawdHub (skill installer)
- Skill: `skills/clawdhub/`
- CLI: `/opt/homebrew/bin/clawdhub`
- Version: `clawdhub -V`
- Common commands:
  - Search: `clawdhub search "query"`
  - Install: `clawdhub install <slug>`
  - Update all: `clawdhub update --all --no-input --force`
  - List: `clawdhub list`

---

Add whatever helps you do your job. This is your cheat sheet.
