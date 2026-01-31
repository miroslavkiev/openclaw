#!/usr/bin/env bash
set -euo pipefail

MEDIA_PATH="${1:-}"
if [[ -z "$MEDIA_PATH" ]]; then
  echo "Missing MediaPath" >&2
  exit 2
fi

MLX_WHISPER_BIN="/Users/mk/.local/bin/mlx_whisper"
if [[ ! -x "$MLX_WHISPER_BIN" ]]; then
  echo "mlx_whisper not found at $MLX_WHISPER_BIN" >&2
  exit 3
fi

LOG_DIR="/tmp/openclaw"
LOG_FILE="$LOG_DIR/audio-transcribe.jsonl"
mkdir -p "$LOG_DIR"

now_ms() {
  python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
}

START_MS="$(now_ms)"
MEDIA_BASENAME="$(basename "$MEDIA_PATH")"
MODEL_NAME="mlx-community/whisper-large-v3-turbo"
LANG="uk"

# Emit a start marker (JSONL) so we can measure later.
python3 - <<PY >>"$LOG_FILE"
import json
print(json.dumps({
  "event": "transcribe_start",
  "tsMs": int("$START_MS"),
  "mediaPath": "$MEDIA_PATH",
  "media": "$MEDIA_BASENAME",
  "model": "$MODEL_NAME",
  "language": "$LANG",
  "pid": int("$$"),
}))
PY

TMPDIR_OUT="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_OUT"' EXIT

# NOTE: OpenClaw's transcription runner reads stdout.
# mlx_whisper writes to a file by default, so we write to a temp dir and cat the result.
set +e
"$MLX_WHISPER_BIN" \
  "$MEDIA_PATH" \
  --model "$MODEL_NAME" \
  --language "$LANG" \
  --output-format "txt" \
  --output-dir "$TMPDIR_OUT" \
  --output-name "out" \
  --verbose "False" \
  >/dev/null
EXIT_CODE=$?
set -e

END_MS="$(now_ms)"
DUR_MS=$((END_MS - START_MS))

python3 - <<PY >>"$LOG_FILE"
import json
print(json.dumps({
  "event": "transcribe_end",
  "tsMs": int("$END_MS"),
  "durationMs": int("$DUR_MS"),
  "exitCode": int("$EXIT_CODE"),
  "mediaPath": "$MEDIA_PATH",
  "media": "$MEDIA_BASENAME",
  "model": "$MODEL_NAME",
  "language": "$LANG",
}))
PY

if [[ "$EXIT_CODE" -ne 0 ]]; then
  echo "mlx_whisper failed (exit=$EXIT_CODE)" >&2
  exit "$EXIT_CODE"
fi

cat "$TMPDIR_OUT/out.txt"
