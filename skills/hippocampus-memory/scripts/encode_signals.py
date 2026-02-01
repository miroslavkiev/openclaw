#!/usr/bin/env python3
"""Encode preprocessed user signals into hippocampus index.json.

This is a lightweight, heuristic encoder (no LLM required) to make the
hippocampus skill immediately value-adding.

Inputs:
  - WORKSPACE/memory/signals.jsonl (from preprocess.sh)
Outputs:
  - WORKSPACE/memory/index.json (updated)
  - Updates lastProcessedMessageId watermark

Memory schema used by decay/sync-core:
  {id, domain, content, importance, created, lastAccessed, source}
"""

import json
import os
from datetime import date, datetime

WORKSPACE = os.environ.get("WORKSPACE") or os.path.join(os.path.expanduser("~"), ".openclaw", "workspace")
MEM_DIR = os.path.join(WORKSPACE, "memory")
SIGNALS_PATH = os.path.join(MEM_DIR, "signals.jsonl")
INDEX_PATH = os.path.join(MEM_DIR, "index.json")

TODAY = str(date.today())
NOW_ISO = datetime.now().isoformat()


def classify(text: str):
    t = text.lower()

    # Importance heuristics
    importance = 0.60
    if "remember" in t or "запам" in t:
        importance = 0.90
    elif "i prefer" in t or "я предпоч" in t or "я надаю перевагу" in t or "мені краще" in t:
        importance = 0.80
    elif "decision" in t or "виріш" in t or "домов" in t:
        importance = 0.75

    # Domain heuristics
    domain = "user"
    if any(k in t for k in ["lucy", "люся", "relationship", "ми "]):
        domain = "relationship"
    if any(k in t for k in ["weather", "погода", "news", "новин", "статт", "wikipedia"]):
        domain = "world"

    return domain, importance


def load_index():
    if not os.path.exists(INDEX_PATH):
        return {"version": 1, "lastUpdated": None, "lastProcessedMessageId": None, "decayLastRun": None, "memories": []}
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    if not os.path.exists(SIGNALS_PATH):
        print(f"No signals file found: {SIGNALS_PATH}")
        return 0

    idx = load_index()
    existing_ids = {m.get("id") for m in idx.get("memories", [])}

    added = 0
    last_signal_id = None

    with open(SIGNALS_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                sig = json.loads(line)
            except Exception:
                continue

            sid = sig.get("id") or ""
            text = (sig.get("text") or "").strip()
            if not sid or not text:
                continue

            last_signal_id = sid
            mem_id = f"msg-{sid}"
            if mem_id in existing_ids:
                continue

            domain, importance = classify(text)

            idx.setdefault("memories", []).append({
                "id": mem_id,
                "domain": domain,
                "content": text,
                "importance": round(float(importance), 3),
                "created": TODAY,
                "lastAccessed": TODAY,
                "source": {
                    "kind": "openclaw-session",
                    "messageId": sid,
                    "timestamp": sig.get("timestamp")
                }
            })
            existing_ids.add(mem_id)
            added += 1

    if last_signal_id:
        idx["lastProcessedMessageId"] = last_signal_id
    idx["lastUpdated"] = NOW_ISO

    os.makedirs(MEM_DIR, exist_ok=True)
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(idx, f, ensure_ascii=False, indent=2)

    print(f"Added {added} memories. Watermark={idx.get('lastProcessedMessageId')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
