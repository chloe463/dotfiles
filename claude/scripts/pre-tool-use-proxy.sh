#!/usr/bin/env bash
# PreToolUse proxy: the only PreToolUse entry in settings.json; it fans out to
# the guards below.
#
# When more than one PreToolUse entry matches the same tool, Claude Code drops
# the `updatedInput` returned by a hook (anthropics/claude-code#15897), which
# would discard runok's sandbox rewrite. Add new guards here instead of adding
# another PreToolUse entry.
#
# Hook stderr is discarded, so failures are logged to ~/.claude/logs. If the
# rules can't be evaluated, the proxy asks for confirmation rather than falling
# through, since falling through would silently disable every ask/deny rule.
# It doesn't deny, so a broken runok can still be diagnosed from Claude Code.
set -uo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LOG_DIR="${HOME}/.claude/logs"
readonly LOG_FILE="${LOG_DIR}/$(id -un)-hook-pre-tool-use-proxy.log"
readonly RUNOK_CONFIG="${XDG_CONFIG_HOME:-${HOME}/.config}/runok/runok.yml"

log() {
  mkdir -p "${LOG_DIR}" 2>/dev/null && printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" >>"${LOG_FILE}"
}

# Printed without jq because jq itself may be what failed. `reason` must not
# contain characters that need JSON escaping.
ask_and_exit() {
  local reason="$1"
  log "[error] ${reason}"
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"%s"}}\n' \
    "${reason}. Permission rules were not evaluated."
  exit 0
}

input=$(cat)
tool_name=$(jq -r '.tool_name // empty' <<<"${input}" 2>/dev/null) || ask_and_exit "failed to parse hook input"

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

    command -v runok >/dev/null 2>&1 || ask_and_exit "runok not found"
    # Without a config runok exits 0 with no output, which looks like `pass`.
    [[ -f "${RUNOK_CONFIG}" ]] || ask_and_exit "runok config not found"

    output=$(runok hook --agent claude-code <<<"${input}")
    status=$?
    ((status == 0)) || ask_and_exit "runok hook exited with ${status}"
    # Empty stdout means `pass` (no rule matched).
    if [[ -n "${output}" ]]; then
      jq -e . >/dev/null 2>&1 <<<"${output}" || ask_and_exit "runok hook printed non-JSON output"
      printf '%s\n' "${output}"
    fi
    ;;
esac
exit 0
