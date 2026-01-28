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

### Gmail signatures (gog)
- Work Gmail account: krmy@ciklum.com
- Default send-as: myroslav.kravchenko@ciklum.com
- When creating Gmail drafts via `gog gmail drafts create/update`, append the official HTML signature from:
  - `gog --account krmy@ciklum.com gmail settings sendas get myroslav.kravchenko@ciklum.com --json`
  - JSON path: `.sendAs.signature` (HTML)

---

Add whatever helps you do your job. This is your cheat sheet.
