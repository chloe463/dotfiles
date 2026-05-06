#!/usr/bin/env bash

# This script is copied from https://notfounds.hatenablog.com/entry/2021/12/20/git_sync and added some lines

set -euo pipefail

version="0.1.0"

usage() {
  cat <<EOF
$(basename ${0}) - Synchronize main/master branch with the remote.
Usage:
    $(basename ${0}) [-c]
Options:
    --current, -c     synchronize curent branch with the remote
    --version, -v     print $(basename ${0}) version
    --help, -h        print this
EOF
  exit
}

version() {
  echo "$(basename ${0}) version ${version}"
  exit
}

die() {
  local msg=$1
  local code=${2-1}
  echo "$msg" >&2
  exit "$code"
}

parse_params() {
  current_branch=0

  while :; do
    case "${1-}" in
    -c | --current) current_branch=1 ;;
    -h | --help) usage ;;
    -v | --version) version ;;
    -?*) die "Unknown option: $1" ;;
    *) break ;;
    esac
    shift
  done

  return 0
}

parse_params "$@"


if [ $current_branch -eq 1 ]; then
  # Sync current branch
  branch=$(git rev-parse --abbrev-ref HEAD)
else
  # Determine whether the main stream branch is "main" or "master".
  branch=$(git branch -l master main | sed 's/^[* ]*//' | head -1)
fi


# Switch branch
git switch "${branch}"

# Fetch and Pull
git fetch -p origin && git pull origin "${branch}"

# Remove squash merged branches if git-delete-squashed is installed
# cf. https://github.com/not-an-aardvark/git-delete-squashed
if type git-delete-squashed > /dev/null 2>&1; then
  git-delete-squashed "${branch}"
fi

# Remove merged branches
merged_branches=()
if git_branch_output=$(git branch --merged 2>&1); then
  while IFS= read -r b; do
    [[ -n "$b" ]] && merged_branches+=("$b")
  done < <(printf '%s\n' "$git_branch_output" | grep -v master | grep -v main | grep -v '\*' || true)
else
  echo "git-sync: 'git branch --merged' failed: ${git_branch_output}" >&2
  echo "Skipping merged branch cleanup." >&2
fi

if [ ${#merged_branches[@]} -gt 0 ]; then
  if ! git branch -d "${merged_branches[@]}"; then
    echo "git-sync: some branches could not be deleted." >&2
    echo "If a branch was squash-merged, use 'git branch -D <branch>' to force delete." >&2
  fi
fi