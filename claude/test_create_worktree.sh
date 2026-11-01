#!/usr/bin/env bash
# Tests for claude/skills/delegate-to-worker/scripts/create-worktree.sh
#
# Runs the real script against throwaway git repositories with a fake `herdr`
# on PATH, so neither herdr nor network access is needed. Requires git and jq.
# Kept compatible with bash 3.2 (macOS /bin/bash) because the script targets it.
#
# Usage: claude/test_create_worktree.sh

set -uo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/skills/delegate-to-worker/scripts/create-worktree.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Isolate from the developer's own git config (aliases, url rewrites, signing, ...).
export GIT_CONFIG_GLOBAL=/dev/null
export GIT_CONFIG_SYSTEM=/dev/null
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com

pass=0
fail=0

ok() {
  pass=$((pass + 1))
  echo "ok - $1"
}

ko() {
  fail=$((fail + 1))
  echo "not ok - $1"
  if [ -n "${2:-}" ]; then echo "    $2"; fi
}

assert_eq() { # name expected actual
  if [ "$2" = "$3" ]; then ok "$1"; else ko "$1" "expected: [$2] actual: [$3]"; fi
}

assert_contains() { # name haystack needle
  case "$2" in
    *"$3"*) ok "$1" ;;
    *) ko "$1" "missing [$3] in: [$2]" ;;
  esac
}

# Run a command, capturing stdout/stderr/exit code into OUT/ERR/CODE.
run() {
  "$@" >"$TMP/out" 2>"$TMP/err"
  CODE=$?
  OUT="$(cat "$TMP/out")"
  ERR="$(cat "$TMP/err")"
}

# --- Fixtures -----------------------------------------------------------------

# A fake herdr that supports only `herdr worktree create`, backed by `git worktree add`.
#   FAKE_HERDR_FAIL=1     -> exit 1 (creation fails)
#   FAKE_HERDR_NO_PATH=1  -> succeed but return JSON without a worktree path
mkdir -p "$TMP/bin" "$TMP/worktrees"
cat >"$TMP/bin/herdr" <<'EOF'
#!/usr/bin/env bash
if [ "${1:-} ${2:-}" != "worktree create" ]; then
  echo "fake herdr: unsupported: $*" >&2
  exit 64
fi
shift 2
cwd="" branch="" base=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --cwd) cwd="$2"; shift 2 ;;
    --branch) branch="$2"; shift 2 ;;
    --base) base="$2"; shift 2 ;;
    --label) shift 2 ;;
    *) shift ;;
  esac
done
if [ -n "${FAKE_HERDR_FAIL:-}" ]; then
  echo "fake herdr: boom" >&2
  exit 1
fi
if [ -n "${FAKE_HERDR_NO_PATH:-}" ]; then
  echo '{"result":{"workspace":{"workspace_id":"w1"},"root_pane":{"pane_id":"p1"},"worktree":{}}}'
  exit 0
fi
path="$FAKE_HERDR_WORKTREES/$branch"
git -C "$cwd" worktree add -q -b "$branch" "$path" "$base" >/dev/null
printf '{"result":{"workspace":{"workspace_id":"w1"},"root_pane":{"pane_id":"p1"},"worktree":{"path":"%s"}}}\n' "$path"
EOF
chmod +x "$TMP/bin/herdr"
export PATH="$TMP/bin:$PATH"
export FAKE_HERDR_WORKTREES="$TMP/worktrees"

# repo: a clone of a bare "origin" with one commit on main that tracks tracked-dir/file.
git init -q --bare "$TMP/origin.git"
git clone -q "$TMP/origin.git" "$TMP/repo" 2>/dev/null
REPO="$TMP/repo"
git -C "$REPO" symbolic-ref HEAD refs/heads/main
mkdir -p "$REPO/tracked-dir"
echo keep >"$REPO/tracked-dir/file"
git -C "$REPO" add tracked-dir
git -C "$REPO" commit -q -m "initial commit"
git -C "$REPO" push -q origin main 2>/dev/null
# Untracked dependency directories that exist only in the main checkout.
mkdir -p "$REPO/node_modules" "$REPO/extra-dir"

SCRIPT_ARGS_BASE=(--repo "$REPO" --base origin/main --label "t1 test")

# --- Argument handling --------------------------------------------------------

run "$SCRIPT" --help
assert_eq "--help exits 0" 0 "$CODE"
assert_contains "--help prints usage" "$ERR" "Usage:"
assert_contains "--help mentions --repo" "$ERR" "--repo"

run env HERDR_ENV=1 "$SCRIPT" --bogus
assert_eq "unknown argument exits 1" 1 "$CODE"
assert_contains "unknown argument is reported" "$ERR" "unknown argument: --bogus"

run env HERDR_ENV=1 "$SCRIPT" --repo "$REPO"
assert_eq "missing required arguments exits 1" 1 "$CODE"
assert_contains "missing required arguments is reported" "$ERR" "are required"

run env -u HERDR_ENV "$SCRIPT" "${SCRIPT_ARGS_BASE[@]}" --branch b-outside
assert_eq "outside herdr exits 2" 2 "$CODE"
assert_contains "outside herdr mentions HERDR_ENV" "$ERR" "HERDR_ENV"

run env HERDR_ENV=1 "$SCRIPT" --repo "$REPO" --branch b-nobase --base origin/does-not-exist --label "t1 test"
assert_eq "unknown base exits 3" 3 "$CODE"
assert_contains "unknown base is reported" "$ERR" "base not found: origin/does-not-exist"

# --- --dry-run ----------------------------------------------------------------

run env HERDR_ENV=1 "$SCRIPT" "${SCRIPT_ARGS_BASE[@]}" --branch b-dry --dry-run
assert_eq "--dry-run exits 0" 0 "$CODE"
assert_eq "--dry-run prints nothing on stdout" "" "$OUT"
assert_contains "--dry-run plans to link an existing dir" "$ERR" "[dry-run] would link: node_modules"
assert_contains "--dry-run plans to skip a missing dir" "$ERR" "[dry-run] missing from root, would skip: .husky/_"
assert_eq "--dry-run creates no worktree" 1 "$(git -C "$REPO" worktree list | wc -l | tr -d ' ')"

# --- Real run (default links, base = origin/main) -----------------------------

run env HERDR_ENV=1 "$SCRIPT" "${SCRIPT_ARGS_BASE[@]}" --branch b-default
assert_eq "default run exits 0" 0 "$CODE"
LAST="$(printf '%s\n' "$OUT" | tail -n 1)"
if printf '%s' "$LAST" | jq -e . >/dev/null 2>&1; then ok "last stdout line is valid JSON"; else ko "last stdout line is valid JSON" "$LAST"; fi
WT="$(printf '%s' "$LAST" | jq -r .path)"
assert_eq "JSON workspace_id" w1 "$(printf '%s' "$LAST" | jq -r .workspace_id)"
assert_eq "JSON pane_id" p1 "$(printf '%s' "$LAST" | jq -r .pane_id)"
assert_eq "JSON branch" b-default "$(printf '%s' "$LAST" | jq -r .branch)"
assert_contains "JSON head is the base tip" "$(printf '%s' "$LAST" | jq -r .head)" "initial commit"
assert_eq "JSON links" '["node_modules"]' "$(printf '%s' "$LAST" | jq -c .links)"
assert_eq "JSON skipped" '[".husky/_ (missing from root)"]' "$(printf '%s' "$LAST" | jq -c .skipped)"
assert_contains "missing link source warns on stderr" "$ERR" "warning: .husky/_ does not exist in the repo root"
if [ -L "$WT/node_modules" ]; then ok "node_modules is a symlink in the worktree"; else ko "node_modules is a symlink in the worktree"; fi
assert_eq "symlink points at the main checkout" "$REPO/node_modules" "$(readlink "$WT/node_modules")"

# --- --link / --no-default-links ----------------------------------------------

run env HERDR_ENV=1 "$SCRIPT" "${SCRIPT_ARGS_BASE[@]}" --branch b-extra --no-default-links --link extra-dir
assert_eq "--link run exits 0" 0 "$CODE"
LAST="$(printf '%s\n' "$OUT" | tail -n 1)"
WT="$(printf '%s' "$LAST" | jq -r .path)"
assert_eq "--link adds the extra dir only" '["extra-dir"]' "$(printf '%s' "$LAST" | jq -c .links)"
assert_eq "--no-default-links leaves nothing skipped" '[]' "$(printf '%s' "$LAST" | jq -c .skipped)"
if [ ! -e "$WT/node_modules" ]; then ok "--no-default-links does not link node_modules"; else ko "--no-default-links does not link node_modules"; fi

# --- Existing destination is never overwritten ---------------------------------

run env HERDR_ENV=1 "$SCRIPT" "${SCRIPT_ARGS_BASE[@]}" --branch b-exists --no-default-links --link tracked-dir
assert_eq "existing destination run exits 0" 0 "$CODE"
LAST="$(printf '%s\n' "$OUT" | tail -n 1)"
WT="$(printf '%s' "$LAST" | jq -r .path)"
assert_eq "existing destination is skipped" '["tracked-dir (already exists in worktree)"]' "$(printf '%s' "$LAST" | jq -c .skipped)"
assert_contains "existing destination warns on stderr" "$ERR" "warning: tracked-dir already exists in the worktree"
if [ ! -L "$WT/tracked-dir" ] && [ -f "$WT/tracked-dir/file" ]; then ok "existing destination is left untouched"; else ko "existing destination is left untouched"; fi

# --- Local base (no fetch) ----------------------------------------------------

run env HERDR_ENV=1 "$SCRIPT" --repo "$REPO" --base main --label "t1 test" --branch b-local-base
assert_eq "local base run exits 0" 0 "$CODE"

# --- herdr failures -----------------------------------------------------------

run env HERDR_ENV=1 FAKE_HERDR_FAIL=1 "$SCRIPT" "${SCRIPT_ARGS_BASE[@]}" --branch b-fail
assert_eq "herdr failure exits 4" 4 "$CODE"
assert_contains "herdr failure is reported" "$ERR" "failed to create the worktree"

run env HERDR_ENV=1 FAKE_HERDR_NO_PATH=1 "$SCRIPT" "${SCRIPT_ARGS_BASE[@]}" --branch b-nopath
assert_eq "missing worktree path exits 4" 4 "$CODE"
assert_contains "missing worktree path is reported" "$ERR" "could not read the worktree path"

# --- Helper functions (sourced in a subshell: the script enables set -euo) ----

assert_eq "to_json_array with no args" '[]' "$( (source "$SCRIPT"; to_json_array) )"
assert_eq "to_json_array keeps spaces" '["a","b c"]' "$( (source "$SCRIPT"; to_json_array a "b c") )"

mkdir -p "$TMP/unit-root/dir" "$TMP/unit-dest"
assert_eq "link_dirs links one and skips one" \
  '{"links":["dir"],"skipped":["nope (missing from root)"]}' \
  "$( (source "$SCRIPT"; link_dirs "$TMP/unit-root" "$TMP/unit-dest" dir nope 2>/dev/null) )"

# --- Summary ------------------------------------------------------------------

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
