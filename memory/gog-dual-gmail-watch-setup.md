# Dual GOG Gmail watch setup (work + personal)

Goal: run two parallel Gmail Pub/Sub push receivers so we can process both Gmail accounts without constantly switching state.

Accounts:
- Work Gmail: krmy@ciklum.com
- Personal Gmail: kravch@gmail.com

Local push receivers (Pub/Sub push handlers):
- Personal receiver: 127.0.0.1:8788 (hostname: gmail-personal.kravchen.com)
- Work receiver:     127.0.0.1:8789 (hostname: gmail-work.kravchen.com)

LaunchAgents (macOS):
- ~/Library/LaunchAgents/com.mk.gog.gmail-personal-serve.plist
  - Runs: `gog --client personal --account kravch@gmail.com gmail watch serve --bind 127.0.0.1 --port 8788 --path / --token <token> --hook-url http://127.0.0.1:18789/hooks/gmail-personal --hook-token <hook-token> --include-body --max-bytes 20000`
  - Logs:
    - ~/Library/Logs/gog-gmail-personal-serve.log
    - ~/Library/Logs/gog-gmail-personal-serve.err.log
- ~/Library/LaunchAgents/com.mk.gog.gmail-work-serve.plist
  - Runs: `gog --client work --account krmy@ciklum.com gmail watch serve --bind 127.0.0.1 --port 8789 --path / --token <token> --hook-url http://127.0.0.1:18990/gmail-work --hook-token <hook-token> --include-body --max-bytes 20000`
  - Logs:
    - ~/Library/Logs/gog-gmail-work-serve.log
    - ~/Library/Logs/gog-gmail-work-serve.err.log
- ~/Library/LaunchAgents/com.mk.gog.gmail-personal-renew.plist
  - Runs: `gog --client personal --account kravch@gmail.com gmail watch renew --ttl 720h`
  - StartInterval: 21600 (6h)
  - Logs:
    - ~/Library/Logs/gog-gmail-personal-renew.log
    - ~/Library/Logs/gog-gmail-personal-renew.err.log
- ~/Library/LaunchAgents/com.mk.gog.gmail-work-renew.plist
  - Runs: `gog --client work --account krmy@ciklum.com gmail watch renew --ttl 720h`
  - StartInterval: 21600 (6h)
  - Logs:
    - ~/Library/Logs/gog-gmail-work-renew.log
    - ~/Library/Logs/gog-gmail-work-renew.err.log

Downstream draft service (work):
- ~/Library/LaunchAgents/com.mk.gmail-drafter.plist
  - Runs: `node /Users/mk/clawd/services/gmail-drafter/gmail-drafter.js`
  - Env:
    - PORT=18990
    - HOOK_TOKEN=<token>
    - WORK_ACCOUNT=krmy@ciklum.com
    - WORK_RECIPIENTS=myroslav.kravchenko@ciklum.com,krmy@ciklum.com
    - GOG_BIN=/opt/homebrew/bin/gog
    - GOG_CLIENT=work
  - Endpoint: POST http://127.0.0.1:18990/gmail-work (Authorization: Bearer $HOOK_TOKEN)

GOG watch state (important):
- `gog gmail watch status` is per account.
- Work watch currently includes a stored hook config:
  - hook.url = http://127.0.0.1:18990/gmail-work
  - hook.token = <HOOK_TOKEN>
- Personal watch may not include a stored hook in status (depends if `--save-hook` was used), but the serve process still forwards via `--hook-url`.

Common failures + fixes:
- Port bind error ("address already in use") on 8788/8789:
  - check listener: `/usr/sbin/lsof -nP -iTCP:<port> -sTCP:LISTEN`
  - restart LaunchAgent (`launchctl unload/load`), ensure only one serve process per port.
- calendar API disabled errors are unrelated to Gmail watch.

Notes:
- In this environment, `launchctl bootstrap` sometimes fails with I/O error; `launchctl load -w <plist>` works.
