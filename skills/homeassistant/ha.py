#!/usr/bin/env python3

import json
import os
import sys
import urllib.request
import urllib.error


def _env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        raise SystemExit(f"Missing env var: {name}")
    return v


def _request(method: str, path: str, body=None):
    base = _env("HA_URL").rstrip("/")
    token = _env("HA_TOKEN")

    url = f"{base}{path}"

    data = None
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }

    if body is not None:
        if isinstance(body, (dict, list)):
            body = json.dumps(body)
        if isinstance(body, str):
            body = body.encode("utf-8")
        data = body
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8")
            if not raw:
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HA HTTP {e.code} {e.reason}: {detail}")
    except urllib.error.URLError as e:
        raise SystemExit(f"HA connection error: {e}")


def cmd_list():
    states = _request("GET", "/api/states")
    # Print a small, useful subset.
    out = []
    for s in states:
        out.append(
            {
                "entity_id": s.get("entity_id"),
                "state": s.get("state"),
                "name": (s.get("attributes") or {}).get("friendly_name"),
            }
        )
    print(json.dumps(out, ensure_ascii=False, indent=2))


def cmd_state(entity_id: str):
    s = _request("GET", f"/api/states/{entity_id}")
    print(json.dumps(s, ensure_ascii=False, indent=2))


def cmd_service(domain: str, service: str, payload_json: str | None):
    payload = {}
    if payload_json:
        payload = json.loads(payload_json)
    res = _request("POST", f"/api/services/{domain}/{service}", payload)
    print(json.dumps(res, ensure_ascii=False, indent=2))


def cmd_ask(text: str):
    # Home Assistant Conversation/Assist endpoint.
    payload = {"text": text}
    res = _request("POST", "/api/conversation/process", payload)
    print(json.dumps(res, ensure_ascii=False, indent=2))


def main(argv):
    if len(argv) < 2 or argv[1] in {"-h", "--help"}:
        print(
            "Usage:\n"
            "  ha.py list\n"
            "  ha.py state <entity_id>\n"
            "  ha.py service <domain> <service> [json_payload]\n"
            "  ha.py ask <text>\n"
        )
        return 0

    cmd = argv[1]
    if cmd == "list":
        cmd_list()
        return 0
    if cmd == "state":
        if len(argv) < 3:
            raise SystemExit("state requires <entity_id>")
        cmd_state(argv[2])
        return 0
    if cmd == "service":
        if len(argv) < 4:
            raise SystemExit("service requires <domain> <service> [json_payload]")
        payload = argv[4] if len(argv) >= 5 else None
        cmd_service(argv[2], argv[3], payload)
        return 0
    if cmd == "ask":
        if len(argv) < 3:
            raise SystemExit("ask requires <text>")
        cmd_ask(" ".join(argv[2:]))
        return 0

    raise SystemExit(f"Unknown command: {cmd}")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
