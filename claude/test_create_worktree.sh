#!/usr/bin/env bash
# Tests for claude/skills/delegate-to-worker/scripts/create-worktree.sh
#
# Runs the real script against throwaway git repositories with a fake `herdr`
# on PATH, so neither herdr nor network access is needed. Requires git and jq.
#
# The script under test is run with the same bash as this test ($BASH), not
# with whatever its shebang resolves to. So `/bin/bash claude/test_create_worktree.sh`
# exercises both under macOS's bash 3.2, which the script targets.
#
# Usage: claude/test_create_worktree.sh

set -uo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/skills/delegate-to-worker/scripts/create-worktree.sh"

TMP="$(mktemp -d)" || exit 2
trap 'rm -rf "$TMP"' EXIT

echo "# bash under test: $BASH ($BASH_VERSION)"

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

# Run the script under test (with the bash running this test) inside herdr.
run_script() {
  run env HERDR_ENV=1 "$BASH" "$SCRIPT" "$@"
}

# Last stdout line of the previous run (the script's JSON result).
last_line() {
  printf '%s\n' "$OUT" | tail -n 1
}

json_field() { # field  (reads the last stdout line)
  last_line | jq -c "$1"
}

# Run a fixture command; abort the whole suite (exit 2) with the command shown if it fails,
# so a broken fixture is reported as such instead of as a wall of unrelated failures.
setup() {
  "$@" || { echo "setup failed: $*" >&2; exit 2; }
}

setup_write() { # file content
  printf '%s\n' "$2" >"$1" || { echo "setup failed: write $1" >&2; exit 2; }
}

# --- Fixtures -----------------------------------------------------------------

# A fake herdr that supports only `herdr worktree create`, backed by `git worktree add`.
# It records its argv and rejects anything real herdr would reject (unknown or
# stray arguments, missing options), so argument bugs in the script surface here.
#   FAKE_HERDR_FAIL=1     -> exit 1 (creation fails)
#   FAKE_HERDR_NO_PATH=1  -> succeed but return JSON without a worktree path
#   FAKE_HERDR_NO_IDS=1   -> succeed but return JSON without workspace/pane ids
#   FAKE_HERDR_GARBAGE=1  -> succeed but print something that is not JSON
setup mkdir -p "$TMP/bin" "$TMP/worktrees"
cat >"$TMP/bin/herdr" <<'EOF'
#!/usr/bin/env bash
printf '[%s]' "$@" >"$FAKE_HERDR_ARGS"
if [ "${1:-} ${2:-}" != "worktree create" ]; then
  echo "fake herdr: unsupported: $*" >&2
  exit 64
fi
shift 2
cwd="" branch="" base="" label=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --cwd|--branch|--base|--label)
      if [ "$#" -lt 2 ]; then echo "fake herdr: $1 needs a value" >&2; exit 64; fi ;;
  esac
  case "$1" in
    --cwd) cwd="$2"; shift 2 ;;
    --branch) branch="$2"; shift 2 ;;
    --base) base="$2"; shift 2 ;;
    --label) label="$2"; shift 2 ;;
    --no-focus) shift ;;
    *) echo "fake herdr: unexpected argument: $1" >&2; exit 64 ;;
  esac
done
if [ -z "$cwd" ] || [ -z "$branch" ] || [ -z "$base" ] || [ -z "$label" ]; then
  echo "fake herdr: missing option" >&2
  exit 64
fi
if [ -n "${FAKE_HERDR_FAIL:-}" ]; then
  echo "fake herdr: boom" >&2
  exit 1
fi
if [ -n "${FAKE_HERDR_GARBAGE:-}" ]; then
  echo "this is not json"
  exit 0
fi
if [ -n "${FAKE_HERDR_NO_PATH:-}" ]; then
  echo '{"result":{"workspace":{"workspace_id":"w1"},"root_pane":{"pane_id":"p1"},"worktree":{}}}'
  exit 0
fi
path="$FAKE_HERDR_WORKTREES/$branch"
git -C "$cwd" worktree add -q -b "$branch" "$path" "$base" >/dev/null || exit 1
if [ -n "${FAKE_HERDR_NO_IDS:-}" ]; then
  printf '{"result":{"worktree":{"path":"%s"}}}\n' "$path"
  exit 0
fi
printf '{"result":{"workspace":{"workspace_id":"w1"},"root_pane":{"pane_id":"p1"},"worktree":{"path":"%s"}}}\n' "$path"
EOF
setup chmod +x "$TMP/bin/herdr"
export PATH="$TMP/bin:$PATH"
export FAKE_HERDR_WORKTREES="$TMP/worktrees"
export FAKE_HERDR_ARGS="$TMP/herdr.args"

# repo: has a bare "origin" with one commit on main. The commit tracks
#   tracked-dir/file  (a destination that already exists in every worktree)
#   blocker           (a regular file; the main checkout replaces it with a directory below)
REPO="$TMP/repo"
setup git -c init.defaultBranch=main init -q --bare "$TMP/origin.git"
setup git -c init.defaultBranch=main init -q "$REPO"
setup git -C "$REPO" symbolic-ref HEAD refs/heads/main
setup git -C "$REPO" remote add origin "$TMP/origin.git"
setup mkdir -p "$REPO/tracked-dir"
setup_write "$REPO/tracked-dir/file" keep
setup_write "$REPO/blocker" "a file in the commit"
setup git -C "$REPO" add tracked-dir blocker
setup git -C "$REPO" commit -q -m "initial commit"
setup git -C "$REPO" push -q origin main
# Untracked dependency directories that exist only in the main checkout.
setup mkdir -p "$REPO/node_modules" "$REPO/extra-dir"
# `blocker/sub` exists in the main checkout, but `blocker` is a file in every worktree,
# so creating the link's parent directory there must fail.
setup rm "$REPO/blocker"
setup mkdir -p "$REPO/blocker/sub"

SCRIPT_ARGS_BASE=(--repo "$REPO" --base origin/main --label "t1 test")

# --- Argument handling --------------------------------------------------------

run "$BASH" "$SCRIPT" --help
assert_eq "--help exits 0" 0 "$CODE"
assert_contains "--help prints usage" "$ERR" "Usage:"
assert_contains "--help mentions --repo" "$ERR" "--repo"

run_script --bogus
assert_eq "unknown argument exits 1" 1 "$CODE"
assert_contains "unknown argument is reported" "$ERR" "unknown argument: --bogus"

run_script --repo "$REPO"
assert_eq "missing required arguments exits 1" 1 "$CODE"
assert_contains "missing required arguments is reported" "$ERR" "are required"

run env -u HERDR_ENV "$BASH" "$SCRIPT" "${SCRIPT_ARGS_BASE[@]}" --branch b-outside
assert_eq "outside herdr exits 2" 2 "$CODE"
assert_contains "outside herdr mentions HERDR_ENV" "$ERR" "HERDR_ENV"

run_script --repo "$REPO" --branch b-nobase --base origin/does-not-exist --label "t1 test"
assert_eq "unknown base exits 3" 3 "$CODE"
assert_contains "unknown base is reported" "$ERR" "base not found: origin/does-not-exist"

# --- --dry-run ----------------------------------------------------------------

run_script "${SCRIPT_ARGS_BASE[@]}" --branch b-dry --dry-run
assert_eq "--dry-run exits 0" 0 "$CODE"
assert_eq "--dry-run prints nothing on stdout" "" "$OUT"
assert_contains "--dry-run plans to link an existing dir" "$ERR" "[dry-run] would link: node_modules"
assert_contains "--dry-run plans to skip a missing dir" "$ERR" "[dry-run] missing from root, would skip: .husky/_"
assert_eq "--dry-run creates no worktree" 1 "$(git -C "$REPO" worktree list | wc -l | tr -d ' ')"

# --- Real run (default links, base = origin/main) -----------------------------

run_script "${SCRIPT_ARGS_BASE[@]}" --branch b-default
assert_eq "default run exits 0" 0 "$CODE"
LAST="$(last_line)"
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

run_script "${SCRIPT_ARGS_BASE[@]}" --branch b-extra --no-default-links --link extra-dir
assert_eq "--link run exits 0" 0 "$CODE"
WT="$(last_line | jq -r .path)"
assert_eq "--link adds the extra dir only" '["extra-dir"]' "$(json_field .links)"
assert_eq "--no-default-links leaves nothing skipped" '[]' "$(json_field .skipped)"
if [ ! -e "$WT/node_modules" ]; then ok "--no-default-links does not link node_modules"; else ko "--no-default-links does not link node_modules"; fi

# A trailing slash must not break the link (`ln -s src dest/` fails when dest does not exist).
run_script "${SCRIPT_ARGS_BASE[@]}" --branch b-slash --no-default-links --link extra-dir/
assert_eq "--link with a trailing slash exits 0" 0 "$CODE"
WT="$(last_line | jq -r .path)"
assert_eq "trailing slash is normalized in links" '["extra-dir"]' "$(json_field .links)"
assert_eq "trailing slash link points at the main checkout" "$REPO/extra-dir" "$(readlink "$WT/extra-dir")"

# --- Existing destination is never overwritten ---------------------------------

run_script "${SCRIPT_ARGS_BASE[@]}" --branch b-exists --no-default-links --link tracked-dir
assert_eq "existing destination run exits 0" 0 "$CODE"
WT="$(last_line | jq -r .path)"
assert_eq "existing destination is skipped" '["tracked-dir (already exists in worktree)"]' "$(json_field .skipped)"
assert_contains "existing destination warns on stderr" "$ERR" "warning: tracked-dir already exists in the worktree"
if [ ! -L "$WT/tracked-dir" ] && [ -f "$WT/tracked-dir/file" ]; then ok "existing destination is left untouched"; else ko "existing destination is left untouched"; fi

# --- A link that cannot be created is reported, not claimed as linked ---------
# Regression: link_dirs runs inside $(...), where set -e does not apply, so a failing
# mkdir/ln used to be recorded as "linked" with exit 0. This must run the script itself;
# sourcing link_dirs in a subshell re-enables -e and would not reproduce it.

run_script "${SCRIPT_ARGS_BASE[@]}" --branch b-linkfail --no-default-links --link blocker/sub
assert_eq "failed link run exits 0" 0 "$CODE"
assert_eq "failed link is not reported as linked" '[]' "$(json_field .links)"
assert_eq "failed link is reported as skipped" '["blocker/sub (link failed)"]' "$(json_field .skipped)"
assert_contains "failed link warns on stderr" "$ERR" "warning: failed to link blocker/sub"

# --- Local base (no fetch) ----------------------------------------------------

run_script --repo "$REPO" --base main --label "t1 test" --branch b-local-base
assert_eq "local base run exits 0" 0 "$CODE"

# --- origin/* base is fetched and is what the worktree starts from ------------
# The fixture so far has a single commit, so a missing fetch or a wrong base would be
# invisible. Advance origin/main behind the main checkout's back, then check.

NEW_TIP="$(git -C "$TMP/origin.git" commit-tree -m "second commit" -p main "main^{tree}")" || exit 2
setup git -C "$TMP/origin.git" update-ref refs/heads/main "$NEW_TIP"
run_script "${SCRIPT_ARGS_BASE[@]}" --branch b-fetched
assert_eq "fetched run exits 0" 0 "$CODE"
assert_eq "origin/* base is fetched" "$NEW_TIP" "$(git -C "$REPO" rev-parse b-fetched)"
assert_contains "head reflects the worktree tip" "$(last_line | jq -r .head)" "second commit"

# --- herdr receives exactly the documented command line -----------------------
# The arguments are the contract with herdr: pin their order and quoting (the label
# has a space) and that the resolved commit, not the symbolic base, is passed.

SHA="$(git -C "$REPO" rev-parse origin/main)"
run_script "${SCRIPT_ARGS_BASE[@]}" --branch b-args
assert_eq "args run exits 0" 0 "$CODE"
assert_eq "herdr argv" \
  "[worktree][create][--cwd][$REPO][--branch][b-args][--base][$SHA][--label][t1 test][--no-focus]" \
  "$(cat "$FAKE_HERDR_ARGS")"

# --- An unreachable origin only warns -----------------------------------------

REPO2="$TMP/repo2"
setup git -c init.defaultBranch=main init -q "$REPO2"
setup git -C "$REPO2" symbolic-ref HEAD refs/heads/main
setup_write "$REPO2/f" x
setup git -C "$REPO2" add f
setup git -C "$REPO2" commit -q -m "repo2 commit"
setup git -C "$REPO2" remote add origin "$TMP/does-not-exist.git"
setup git -C "$REPO2" update-ref refs/remotes/origin/main HEAD
run_script --repo "$REPO2" --base origin/main --label "t1 test" --branch b-offline --dry-run
assert_eq "unreachable origin still exits 0" 0 "$CODE"
assert_contains "unreachable origin warns about a stale base" "$ERR" "warning: fetch failed; using possibly stale origin/main"

# --- herdr failures -----------------------------------------------------------

run env HERDR_ENV=1 FAKE_HERDR_FAIL=1 "$BASH" "$SCRIPT" "${SCRIPT_ARGS_BASE[@]}" --branch b-fail
assert_eq "herdr failure exits 4" 4 "$CODE"
assert_contains "herdr failure is reported" "$ERR" "failed to create the worktree"

run env HERDR_ENV=1 FAKE_HERDR_NO_PATH=1 "$BASH" "$SCRIPT" "${SCRIPT_ARGS_BASE[@]}" --branch b-nopath
assert_eq "missing worktree path exits 4" 4 "$CODE"
assert_contains "missing worktree path is reported" "$ERR" "could not read"

run env HERDR_ENV=1 FAKE_HERDR_NO_IDS=1 "$BASH" "$SCRIPT" "${SCRIPT_ARGS_BASE[@]}" --branch b-noids
assert_eq "missing workspace/pane ids exits 4" 4 "$CODE"
assert_contains "missing workspace/pane ids is reported" "$ERR" "could not read"

run env HERDR_ENV=1 FAKE_HERDR_GARBAGE=1 "$BASH" "$SCRIPT" "${SCRIPT_ARGS_BASE[@]}" --branch b-garbage
assert_eq "non-JSON herdr output exits 4" 4 "$CODE"
assert_contains "non-JSON herdr output is shown to the user" "$ERR" "this is not json"

# --- jq is required before anything is created --------------------------------

# A PATH with git but no jq. The fake herdr is not reachable either, so reaching it
# would fail differently; the script must stop on the missing jq first.
setup mkdir -p "$TMP/nojq-bin"
setup ln -s "$(command -v git)" "$TMP/nojq-bin/git"
run env HERDR_ENV=1 PATH="$TMP/nojq-bin" GIT_EXEC_PATH="$(git --exec-path)" \
  "$BASH" "$SCRIPT" --repo "$REPO" --base main --label "t1 test" --branch b-nojq
assert_eq "missing jq exits 1" 1 "$CODE"
assert_contains "missing jq is reported" "$ERR" "jq is required"
assert_eq "missing jq creates no worktree" "" "$(git -C "$REPO" branch --list b-nojq)"

# --- Helper functions (sourced in a subshell: the script enables set -euo) ----

assert_eq "to_json_array with no args" '[]' "$( (source "$SCRIPT"; to_json_array) )"
assert_eq "to_json_array keeps spaces" '["a","b c"]' "$( (source "$SCRIPT"; to_json_array a "b c") )"

setup mkdir -p "$TMP/unit-root/dir" "$TMP/unit-dest"
assert_eq "link_dirs links one and skips one" \
  '{"links":["dir"],"skipped":["nope (missing from root)"]}' \
  "$( (source "$SCRIPT"; link_dirs "$TMP/unit-root" "$TMP/unit-dest" dir nope 2>/dev/null) )"

# --- Summary ------------------------------------------------------------------

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
