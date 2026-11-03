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

# Runs a hook on the input. A decision is printed and ends the proxy; empty
# stdout means the hook has no opinion, and the proxy moves on.
run_hook() {
  local name="$1" output status
  shift
  output=$("$@" <<<"${input}")
  status=$?
  ((status == 0)) || ask_and_exit "${name} exited with ${status}"
  [[ -n "${output}" ]] || return 0
  jq -e . >/dev/null 2>&1 <<<"${output}" || ask_and_exit "${name} printed non-JSON output"
  printf '%s\n' "${output}"
  exit 0
}

# Runs `runok hook` and names the matched rules when it asks without a reason,
# since runok only reports a rule's `message` and the prompt would otherwise be
# generic. The rules come from --verbose's human-readable stderr. If that format
# changes nothing matches and the prompt falls back to the generic text; the
# decision itself is never touched. A multi-line command can echo a look-alike
# line, which can add to the list but can't hide a rule that really matched.
runok_hook() {
  local stderr_file output status
  stderr_file=$(mktemp) || return 1
  output=$(runok hook --agent claude-code --verbose 2>"${stderr_file}")
  status=$?
  # On a jq error, print runok's output as is and let run_hook judge it.
  jq -c --arg q "'" --rawfile verbose "${stderr_file}" '
    [$verbose | split("\n")[] | capture("^\\s*├─ ask  \($q)(?<rule>.*)\($q)(  \\(tokens: .*\\))?$").rule] as $rules
    | if .hookSpecificOutput.permissionDecision == "ask"
        and .hookSpecificOutput.permissionDecisionReason == null
        and ($rules | length) > 0
      then .hookSpecificOutput.permissionDecisionReason =
        "runok ask: " + ($rules | unique | map($q + . + $q) | join(", "))
      else . end
  ' 2>/dev/null <<<"${output}" || printf '%s\n' "${output}"
  rm -f "${stderr_file}"
  return "${status}"
}

input=$(cat)
tool_name=$(jq -r '.tool_name // empty' <<<"${input}" 2>/dev/null) || ask_and_exit "failed to parse hook input"

case "${tool_name}" in
  Edit | Write | MultiEdit | NotebookEdit)
    run_hook "block-edit-on-main" bun "${SCRIPT_DIR}/block-edit-on-main.ts"
    ;;
  Bash)
    # Pushes that implicitly target main/master can't be expressed as runok
    # rules (they depend on the checked-out branch), so this runs first.
    run_hook "block-push-to-main" bun "${SCRIPT_DIR}/block-push-to-main.ts"
    # Message files and here-documents are invisible to runok's command-line
    # rules, so issue-closing keywords are checked here.
    run_hook "block-issue-close-keywords" bun "${SCRIPT_DIR}/block-issue-close-keywords.ts"

    command -v runok >/dev/null 2>&1 || ask_and_exit "runok not found"
    # Without a config runok exits 0 with no output, which looks like `pass`.
    [[ -f "${RUNOK_CONFIG}" ]] || ask_and_exit "runok config not found"

    run_hook "runok hook" runok_hook
    ;;
esac
exit 0
