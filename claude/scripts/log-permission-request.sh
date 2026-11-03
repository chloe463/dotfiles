#!/usr/bin/env bash
# PermissionRequest hook: records each permission prompt, so which commands
# still stop the work can be counted. runok's audit log only has its own
# decision, not whether Claude Code's auto mode went on to prompt.
#
# Commands prompted for most often:
#   jq -r '.command // .tool' ~/.claude/logs/$(id -un)-permission-requests.jsonl | cut -d' ' -f1-3 | sort | uniq -c | sort -rn
#
# Prints nothing, so the prompt itself is unaffected.
set -uo pipefail

log_dir="${HOME}/.claude/logs"
mkdir -p "${log_dir}" 2>/dev/null || exit 0

jq -c '{
  time: (now | todate),
  cwd,
  tool: .tool_name,
  command: (.tool_input.command // null | if . then .[0:200] else . end)
}' >>"${log_dir}/$(id -un)-permission-requests.jsonl" 2>/dev/null

exit 0
