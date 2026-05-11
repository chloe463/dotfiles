#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT=(bun "${HOME}/.claude/scripts/notification.ts")
PASS=0
FAIL=0

run_test() {
  local label="$1"
  local input="$2"
  local expect_exit="$3"
  local mode="${4:-}"
  local actual_exit=0
  local output
  local cmd=("${SCRIPT[@]}")
  [[ -n "${mode}" ]] && cmd+=("${mode}")

  echo "=== ${label} ==="
  output=$(printf '%s' "${input}" | "${cmd[@]}" 2>&1) || actual_exit=$?

  if [[ "${actual_exit}" -eq "${expect_exit}" ]]; then
    echo "✓ exit ${actual_exit}"
    PASS=$((PASS + 1))
  else
    echo "✗ expected exit ${expect_exit}, got ${actual_exit}"
    FAIL=$((FAIL + 1))
  fi
  [[ -n "${output}" ]] && echo "${output}"
  echo ""
}

# permission_prompt: shows macOS notification, exits 0
run_test "permission_prompt" \
  '{"hook_event_name":"Notification","notification_type":"permission_prompt","message":"Claude needs your permission to use Bash","title":"Permission needed","session_id":"abc123","transcript_path":"/tmp/test.jsonl","cwd":"/Users/tsuyoshi/dotfiles","type":"command","if":"","timeout":60,"statusMessage":"","once":false}' \
  0

# idle_prompt: skips notification silently, exits 0
run_test "idle_prompt (skipped)" \
  '{"hook_event_name":"Notification","notification_type":"idle_prompt","message":"Waiting for input","title":"Idle","session_id":"abc123","transcript_path":"/tmp/test.jsonl","cwd":"/Users/tsuyoshi/dotfiles","type":"command","if":"","timeout":60,"statusMessage":"","once":false}' \
  0

# stop: valid input, exits 0 and shows macOS notification
run_test "stop (valid)" \
  '{"hook_event_name":"Stop","stop_hook_active":false,"last_assistant_message":"I have completed the task.","session_id":"abc123","transcript_path":"/tmp/test.jsonl","cwd":"/tmp","permission_mode":"default","effort":"high"}' \
  0 \
  "stop"

# stop: stop_hook_active true, exits 0
run_test "stop (stop_hook_active: true)" \
  '{"hook_event_name":"Stop","stop_hook_active":true,"last_assistant_message":"Interrupted.","session_id":"abc123","transcript_path":"/tmp/test.jsonl","cwd":"/tmp","permission_mode":"default","effort":"high"}' \
  0 \
  "stop"

# stop: missing last_assistant_message, exits 1
run_test "stop (missing last_assistant_message)" \
  '{"hook_event_name":"Stop","stop_hook_active":false,"session_id":"abc123","transcript_path":"/tmp/test.jsonl","cwd":"/tmp","permission_mode":"default","effort":"high"}' \
  1 \
  "stop"

# stop: missing stop_hook_active, exits 1
run_test "stop (missing stop_hook_active)" \
  '{"hook_event_name":"Stop","last_assistant_message":"Done.","session_id":"abc123","transcript_path":"/tmp/test.jsonl","cwd":"/tmp","permission_mode":"default","effort":"high"}' \
  1 \
  "stop"

# stop: invalid JSON, exits 1
run_test "stop (invalid JSON)" \
  'not-json' \
  1 \
  "stop"

# missing required field (message): exits 1
run_test "missing message field" \
  '{"hook_event_name":"Notification","notification_type":"permission_prompt","title":"Permission needed"}' \
  1

# missing required field (title): exits 1
run_test "missing title field" \
  '{"hook_event_name":"Notification","notification_type":"permission_prompt","message":"Some message"}' \
  0

# invalid JSON: exits 1
run_test "invalid JSON" \
  'not-json' \
  1

# empty input: exits 1
run_test "empty input" \
  '' \
  1

echo "=== Results: ${PASS} passed, ${FAIL} failed ==="
[[ "${FAIL}" -eq 0 ]]
