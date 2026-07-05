#!/usr/bin/env bash
set -euo pipefail

SESSION_DIR=""
TIMEOUT_SEC="1800"
POLL_INTERVAL_SEC="1"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --session-dir)
      SESSION_DIR="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT_SEC="$2"
      shift 2
      ;;
    --poll-interval)
      POLL_INTERVAL_SEC="$2"
      shift 2
      ;;
    *)
      echo "unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$SESSION_DIR" ]]; then
  echo "missing --session-dir" >&2
  exit 2
fi

STATE_DIR="$SESSION_DIR/state"
COMPLETED_FILE="$STATE_DIR/completed.json"
ANSWERS_FILE="$STATE_DIR/answers.json"

if [[ ! -d "$STATE_DIR" ]]; then
  echo "missing state dir: $STATE_DIR" >&2
  exit 2
fi

start_ts="$(date +%s)"

while true; do
  if [[ -f "$COMPLETED_FILE" ]]; then
    if [[ -f "$ANSWERS_FILE" ]]; then
      cat "$ANSWERS_FILE"
      exit 0
    fi
    echo "completed.json exists but answers.json is missing" >&2
    exit 1
  fi

  now_ts="$(date +%s)"
  if (( now_ts - start_ts >= TIMEOUT_SEC )); then
    echo "timeout waiting for visual companion completion" >&2
    exit 1
  fi

  sleep "$POLL_INTERVAL_SEC"
done
