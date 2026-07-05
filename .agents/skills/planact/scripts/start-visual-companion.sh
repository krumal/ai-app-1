#!/usr/bin/env bash
# Start the planact visual companion server for Codex.
# Usage: start-visual-companion.sh --task-dir <path> [--host <bind-host>] [--url-host <display-host>] [--foreground] [--background]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

TASK_DIR=""
FOREGROUND="true"
FORCE_BACKGROUND="false"
BIND_HOST="127.0.0.1"
URL_HOST=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --task-dir)
      TASK_DIR="$2"
      shift 2
      ;;
    --host)
      BIND_HOST="$2"
      shift 2
      ;;
    --url-host)
      URL_HOST="$2"
      shift 2
      ;;
    --foreground)
      FOREGROUND="true"
      shift
      ;;
    --background)
      FOREGROUND="false"
      FORCE_BACKGROUND="true"
      shift
      ;;
    *)
      echo "{\"error\":\"Unknown argument: $1\"}"
      exit 1
      ;;
  esac
done

if [[ -z "$TASK_DIR" ]]; then
  echo '{"error":"Missing required argument: --task-dir"}'
  exit 1
fi

if [[ -z "$URL_HOST" ]]; then
  if [[ "$BIND_HOST" == "127.0.0.1" || "$BIND_HOST" == "localhost" ]]; then
    URL_HOST="localhost"
  else
    URL_HOST="$BIND_HOST"
  fi
fi

SESSION_ID="$$-$(date +%s)"
SESSION_DIR="${TASK_DIR}/.planact/visual-companion/${SESSION_ID}"
STATE_DIR="${SESSION_DIR}/state"
CONTENT_DIR="${SESSION_DIR}/content"
PID_FILE="${STATE_DIR}/server.pid"
LOG_FILE="${STATE_DIR}/server.log"

mkdir -p "$STATE_DIR" "$CONTENT_DIR"

if [[ "$FOREGROUND" == "true" ]]; then
  echo "$$" > "$PID_FILE"
  env PLANACT_VC_DIR="$SESSION_DIR" PLANACT_VC_HOST="$BIND_HOST" PLANACT_VC_URL_HOST="$URL_HOST" node "$SCRIPT_DIR/server.cjs"
  exit $?
fi

nohup env PLANACT_VC_DIR="$SESSION_DIR" PLANACT_VC_HOST="$BIND_HOST" PLANACT_VC_URL_HOST="$URL_HOST" node "$SCRIPT_DIR/server.cjs" > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
disown "$SERVER_PID" 2>/dev/null || true
echo "$SERVER_PID" > "$PID_FILE"

for _ in {1..50}; do
  if [[ -f "${STATE_DIR}/server-info.json" ]]; then
    cat "${STATE_DIR}/server-info.json"
    exit 0
  fi
  sleep 0.1
done

echo '{"error":"Server failed to start within 5 seconds"}'
exit 1
