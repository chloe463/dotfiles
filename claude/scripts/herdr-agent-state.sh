#!/usr/bin/env bash
set -euo pipefail

readonly HERDR_HOOK="${HOME}/.claude/hooks/herdr-agent-state.sh"

# SessionStart hook stdout is injected into the model's context, so the
# fallback guidance below goes to stderr instead of spamming every session
# for users who don't have herdr installed.
if [[ -f "${HERDR_HOOK}" ]]; then
  bash "${HERDR_HOOK}" session
elif command -v herdr >/dev/null 2>&1; then
  echo "Please run 'herdr integration install claude' first." >&2
else
  echo "herdr is not installed in this machine. Please install it by running 'brew install herdr'" >&2
fi
