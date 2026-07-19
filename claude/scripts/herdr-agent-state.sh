#!/usr/bin/env bash
set -euo pipefail

readonly HERDR_HOOK="${HOME}/.claude/hooks/herdr-agent-state.sh"

if [[ -f "${HERDR_HOOK}" ]]; then
  bash "${HERDR_HOOK}" session
elif command -v herdr >/dev/null 2>&1; then
  echo "Please run 'herdr integration install claude' first."
else
  echo "herdr is not installed in this machine. Please install it by running 'brew install herdr'"
fi
