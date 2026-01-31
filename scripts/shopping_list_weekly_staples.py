#!/usr/bin/env python3

from pathlib import Path

LIST_PATH = Path("/Users/mk/clawd/shopping-list.md")
ITEMS = ["червона риба солона", "авокадо"]


def main():
    txt = LIST_PATH.read_text(encoding="utf-8")
    lines = txt.splitlines(True)

    # Find the Items section.
    try:
        start = next(i for i,l in enumerate(lines) if l.strip() == "## Items")
    except StopIteration:
        raise SystemExit("Could not find '## Items' in shopping-list.md")

    # Ensure there's at least one blank line after header
    i = start + 1
    while i < len(lines) and lines[i].strip() == "":
        i += 1

    # Collect existing bullet items
    existing = set()
    for l in lines[i:]:
        if l.startswith("## "):
            break
        if l.lstrip().startswith("-"):
            item = l.strip()[1:].strip()
            existing.add(item)

    # Append missing items at end of Items section
    insert_at = i
    while insert_at < len(lines) and not lines[insert_at].startswith("## "):
        insert_at += 1

    to_add = [it for it in ITEMS if it not in existing]
    if not to_add:
        return 0

    # Ensure section ends with newline
    if insert_at > 0 and not lines[insert_at-1].endswith("\n"):
        lines[insert_at-1] = lines[insert_at-1] + "\n"

    new_lines = [f"- {it}\n" for it in to_add]
    lines[insert_at:insert_at] = new_lines

    LIST_PATH.write_text("".join(lines), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
