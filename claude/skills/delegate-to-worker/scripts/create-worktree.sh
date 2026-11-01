#!/usr/bin/env bash
# Create a worktree for a worker with herdr, then symlink dependency directories from the main checkout.
#
# Usage:
#   create-worktree.sh --repo <repo-root> --branch <branch> --base <base> --label <label> \
#     [--link <path-relative-to-root>]... [--no-default-links] [--dry-run]
#
#   Example: create-worktree.sh --repo ~/ghq/github.com/<owner>/<repo> \
#         --branch feat/foo --base origin/main --label "1-3-2 short-name"
#
# - Default links are node_modules and .husky/_ . Add more with --link; drop the defaults with --no-default-links
# - A link source missing from the root is skipped with a warning (some repos have no .husky, etc.). Not an error
# - Anything that already exists in the worktree is skipped, never overwritten
# - The last line of stdout is the result as JSON: {"workspace_id","pane_id","path","branch","head","links":[...],"skipped":[...]}
# - Exit codes: 0 = success / 1 = bad arguments / 2 = run outside herdr / 3 = base not found / 4 = worktree creation failed

set -euo pipefail

repo=""
branch=""
base=""
label=""
dry_run=false
use_default_links=true
extra_links=()

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//' >&2
}

# Skip anything whose source (<root>/<relative path>) does not exist, or that already exists at the destination.
# Print the result to stdout as {"links": [...], "skipped": [...]} JSON
link_dirs() {
  local root="$1" dest_root="$2"
  shift 2
  local linked=() skipped=() rel src dest
  for rel in "$@"; do
    src="$root/$rel"
    dest="$dest_root/$rel"
    if [ ! -e "$src" ]; then
      echo "warning: $rel does not exist in the repo root; not linking" >&2
      skipped+=("$rel (missing from root)")
      continue
    fi
    if [ -e "$dest" ] || [ -L "$dest" ]; then
      echo "warning: $rel already exists in the worktree; not overwriting" >&2
      skipped+=("$rel (already exists in worktree)")
      continue
    fi
    mkdir -p "$(dirname "$dest")"
    ln -s "$src" "$dest"
    linked+=("$rel")
  done
  jq -cn \
    --argjson links "$(to_json_array ${linked[@]+"${linked[@]}"})" \
    --argjson skipped "$(to_json_array ${skipped[@]+"${skipped[@]}"})" \
    '{links: $links, skipped: $skipped}'
}

to_json_array() {
  if [ "$#" -eq 0 ]; then
    echo "[]"
  else
    printf '%s\n' "$@" | jq -R . | jq -sc .
  fi
}

# When sourced (for tests), stop after defining the functions
if [ "${BASH_SOURCE[0]}" != "$0" ]; then
  return 0
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo) repo="$2"; shift 2 ;;
    --branch) branch="$2"; shift 2 ;;
    --base) base="$2"; shift 2 ;;
    --label) label="$2"; shift 2 ;;
    --link) extra_links+=("$2"); shift 2 ;;
    --no-default-links) use_default_links=false; shift ;;
    --dry-run) dry_run=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

if [ -z "$repo" ] || [ -z "$branch" ] || [ -z "$base" ] || [ -z "$label" ]; then
  echo "--repo, --branch, --base and --label are required" >&2
  usage
  exit 1
fi

if [ "${HERDR_ENV:-}" != "1" ]; then
  echo "not running inside herdr (HERDR_ENV != 1). Run this from a herdr pane" >&2
  exit 2
fi

repo="$(cd "$repo" && pwd)"

links=()
if [ "$use_default_links" = true ]; then
  links+=("node_modules" ".husky/_")
fi
if [ "${#extra_links[@]}" -gt 0 ]; then
  links+=("${extra_links[@]}")
fi

# --- Verify the base (fetch first if it is origin/<branch>) ---
if [[ "$base" == origin/* ]]; then
  git -C "$repo" fetch -q origin "${base#origin/}" || true
fi
if ! base_commit="$(git -C "$repo" rev-parse --verify -q "${base}^{commit}")"; then
  echo "base not found: $base" >&2
  exit 3
fi
echo "base: $base ($(git -C "$repo" log -1 --oneline "$base_commit"))" >&2

if [ "$dry_run" = true ]; then
  echo "[dry-run] herdr worktree create --cwd $repo --branch $branch --base $base_commit --label \"$label\" --no-focus" >&2
  for rel in ${links[@]+"${links[@]}"}; do
    if [ -e "$repo/$rel" ]; then
      echo "[dry-run] would link: $rel" >&2
    else
      echo "[dry-run] missing from root, would skip: $rel" >&2
    fi
  done
  exit 0
fi

# --- Create the worktree ---
if ! created="$(herdr worktree create --cwd "$repo" --branch "$branch" --base "$base_commit" --label "$label" --no-focus)"; then
  echo "failed to create the worktree" >&2
  exit 4
fi

workspace_id="$(jq -r '.result.workspace.workspace_id' <<<"$created")"
pane_id="$(jq -r '.result.root_pane.pane_id' <<<"$created")"
path="$(jq -r '.result.worktree.path' <<<"$created")"

if [ -z "$path" ] || [ "$path" = "null" ] || [ ! -d "$path" ]; then
  echo "could not read the worktree path. herdr output:" >&2
  echo "$created" >&2
  exit 4
fi

# --- Link the dependency directories ---
link_result="$(link_dirs "$repo" "$path" ${links[@]+"${links[@]}"})"

head="$(git -C "$path" log -1 --oneline)"
echo "created: $path (head: $head)" >&2

jq -c \
  --arg workspace_id "$workspace_id" \
  --arg pane_id "$pane_id" \
  --arg path "$path" \
  --arg branch "$branch" \
  --arg head "$head" \
  '{workspace_id: $workspace_id, pane_id: $pane_id, path: $path, branch: $branch, head: $head} + .' \
  <<<"$link_result"
