# homeassistant

Control Home Assistant (HA) via its REST API.

## Setup (one-time)
This skill expects these environment variables (set via OpenClaw config env injection, not in prompts):
- `HA_URL` (example: `http://127.0.0.1:8123`)
- `HA_TOKEN` (Home Assistant long-lived access token)

## Commands
Use the helper script:

- List entities (brief):
  - `python3 skills/homeassistant/ha.py list`

- Get entity state:
  - `python3 skills/homeassistant/ha.py state light.kitchen`

- Call a service:
  - `python3 skills/homeassistant/ha.py service light turn_on '{"entity_id":"light.kitchen"}'`
  - `python3 skills/homeassistant/ha.py service light turn_off '{"entity_id":"light.kitchen"}'`

- Natural-language via HA Assist (Conversation API):
  - `python3 skills/homeassistant/ha.py ask "Turn off the bathroom light"`

## Agent guidance
- Prefer `ask` for natural commands like “turn off the bathroom light” so HA resolves areas/entities.
- Use `state`/`list` when you need deterministic entity ids.
- If a command affects security-sensitive devices (locks, alarms, garage door), ask for confirmation unless the user explicitly requests it.
