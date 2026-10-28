#!/usr/bin/env bash
# PreToolUse proxy: the only PreToolUse entry in settings.json; it fans out to
# the guards below.
#
# When more than one PreToolUse entry matches the same tool, Claude Code drops
# the `updatedInput` returned by a hook (anthropics/claude-code#15897), which
# would discard runok's sandbox rewrite. Add new guards here instead of adding
# another PreToolUse entry.
#
# Hook stderr is discarded, so failures are logged to ~/.claude/logs. Every
# failure falls through with no output, leaving the decision to Claude Code's
# own permission flow.
set -uo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LOG_DIR="${HOME}/.claude/logs"
readonly LOG_FILE="${LOG_DIR}/$(id -un)-hook-pre-tool-use-proxy.log"

log() {
  mkdir -p "${LOG_DIR}" 2>/dev/null && printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" >>"${LOG_FILE}"
}

input=$(cat)
tool_name=$(jq -r '.tool_name // empty' <<<"${input}" 2>/dev/null) || {
  log "[error] failed to parse hook input"
  exit 0
}

case "${tool_name}" in
  Edit | Write | MultiEdit | NotebookEdit)
    exec bun "${SCRIPT_DIR}/block-edit-on-main.ts" <<<"${input}"
    ;;
  Bash)
    # Pushes that implicitly target main/master can't be expressed as runok
    # rules (they depend on the checked-out branch), so this runs first.
    deny=$(bun "${SCRIPT_DIR}/block-push-to-main.ts" <<<"${input}")
    if [[ -n "${deny}" ]]; then
      printf '%s\n' "${deny}"
      exit 0
    fi

    if ! command -v runok >/dev/null 2>&1; then
      log "[warn] runok not found; falling back to Claude Code permissions"
      exit 0
    fi
    # Empty stdout means `pass` (no rule matched). Anything that isn't JSON is
    # treated the same way rather than risking a malformed decision.
    output=$(runok hook --agent claude-code <<<"${input}")
    status=$?
    if ((status != 0)); then
      log "[error] runok hook exited with ${status}"
      exit 0
    fi
    if [[ -n "${output}" ]] && jq -e . >/dev/null 2>&1 <<<"${output}"; then
      printf '%s\n' "${output}"
    fi
    ;;
esac
exit 0
