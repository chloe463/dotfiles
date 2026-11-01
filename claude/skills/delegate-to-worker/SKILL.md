---
name: delegate-to-worker
description: Acting as the design session (manager), delegate implementation tasks to Claude workers running in herdr worktrees. Covers the whole flow — write a task brief → prepare the worktree → start the worker → wait (including checking whether it is stuck on a permission prompt) → review the diff → commit and PR (including stacked PRs) → cleanup. Use when the user says things like "ワーカーに作業させて", "worktree で実装させて", "指示書を書いてワーカーに渡して", or "1-3-2 に着手". Requires HERDR_ENV=1.
---

# Delegating work to workers

The design session (this session) handles design, task briefs and diff review, and leaves implementation to a worker (Claude Code) running in a separate herdr worktree. The user handles design decisions, manual testing, and approving commits and PRs.

## Prerequisites and rules

- `test "${HERDR_ENV:-}" = 1` must pass. If it doesn't, stop and tell the user. For herdr command details, see the `herdr` skill
- **Make workers run `yarn test` / `yarn typecheck` through a locking wrapper** (e.g. `.ai_logs/YYYY/MM/tools/run-exclusive.sh`). As long as this is followed, there is no upper limit on the number of worktrees running at the same time (the goal is only that heavy commands never run simultaneously; confirmed by the user on 2026-10-29)
- Let the user choose the worker's model before starting it (see 3)
- The user presses the approval for `git commit`, `gh pr create` and `gh api`. **The design session never sends "Yes" on their behalf**. Declining a permission prompt (`2`) is fine
- Workers do not reply to PR comments. For replies to AI reviewers, the design session shows the draft to the user and posts it after approval. The user replies to human reviewers
- Never delete files without the user's confirmation (this includes worktree cleanup: get the user's agreement first)

## 1. Write the task brief

- **Before investigating, bring your local checkout up to date**: `git fetch origin main`, then `git merge --ff-only origin/main` if the working tree is clean. If it isn't clean, inspect origin/main with `git show origin/main:<path>` or `git grep <pattern> origin/main`. This avoids missing changes from a PR that was just merged

- Location: `.ai_logs/YYYY/MM/YYYYMMDD_<project>_task-<id>-<topic>.md`
- If a common rules file exists (e.g. `.ai_logs/YYYY/MM/tools/worker-common-rules.md`), **link it with "must read" instead of copying its contents**. If there isn't one, propose creating it
- What to write in each brief:
  - Requester, date, background material, start conditions (e.g. a base PR), other tasks running in parallel
  - Goal, what is already decided (design conclusions), where to work (branch name and what to branch from)
  - Tests (TDD, 3 categories), verification (how to enumerate which tests to run)
  - PR (base, key points for Why / What, "what this PR does not cover", manual test steps)
  - A "## Result" section at the end (not started)
- Manual test steps must include **the environment to verify (the PR preview) and how to confirm the preview is running the target commit**, and, when URLs or navigation are involved, **how to stop or undo a navigation** (cancel the leave-confirmation, browser back)
- Mark "(needs confirmation)" only on assumptions that haven't been verified against the code and behavior (i.e. that contain guesses)
- **Don't write about tools or practices you don't know from imagination** (e.g. how to build a stacked PR). Ask the user first
- Once written, show it to the user and proceed only after getting their OK

## 2. Prepare the worktree

Create it with the script in the same directory. First run with `--dry-run` to check the base and what will be linked, then run for real.

```sh
~/.claude/skills/delegate-to-worker/scripts/create-worktree.sh \
  --repo <repo root> --branch <branch> --base <base> --label "<task id> <short name>" [--dry-run]
```

- `<base>` is normally `origin/main`. For a stacked PR, use the **base PR's branch** (`origin/<base branch>`). For a base starting with `origin/`, the script fetches before using it
- After creating the worktree, the script links dependency directories to the main checkout. By default these are `node_modules` and `.husky/_`. Add others with `--link <relative path>`; for repos where the defaults don't fit, drop them with `--no-default-links`
- **Link sources missing from the root** (e.g. `.husky/_` in a repo that doesn't use husky) are skipped with a warning. This is not an error, so you can proceed. However, if `node_modules` is skipped the worker can't run tests, so ask the user how to install dependencies
- If the worktree already has something of the same name, it is skipped and not overwritten
- Note the final line of JSON (`workspace_id`, `pane_id`, `path`, `head`, `links`, `skipped`). Don't guess IDs. Check that `head` is the tip of the base
- The linked `.husky/_` shows up as untracked in `git status`, but must not be committed (say so in the instructions to the worker too)
- Exit codes: 1 = bad arguments, 2 = run outside herdr, 3 = base not found, 4 = worktree creation failed. For any of these, stop and tell the user

## 3. Start the worker and hand over the brief

**Don't fix the model.** Before starting, use AskUserQuestion to let the user choose the worker's model.

- Build the options from **the latest model IDs at that time** in the system prompt's "Environment" section (the latest Sonnet, Opus, Haiku, etc.). Don't copy IDs into this file (so it follows model updates)
- Recommendation: the latest Sonnet for routine implementation work; the latest Opus for tasks with many design decisions or hard investigation. Put the recommendation first
- Once the user has chosen within a conversation, the same model may be used for later workers in that conversation (the user says if they want to change). Don't carry it across conversations

```sh
herdr agent start <name> --kind claude --pane <pane_id> --timeout 60000 -- --model <chosen model ID>
herdr agent prompt <name> "Read the following task brief and work according to it: <absolute path of the brief>. <note about the branch base>. Stop and report before committing."
```

- **Right after startup, the prompt you passed may remain in the input box without being submitted** (2026-10-30). If `herdr agent wait <name> --until working --timeout 30000` doesn't reach `working`, look at the input box with `herdr agent read <name> --source visible`, and if the text is still there, send `herdr agent send-keys <name> Enter`

## 4. Wait

Run the following with `run_in_background` and wait for the notification (don't poll):

```sh
herdr agent wait <name> --until idle --until done --until blocked --timeout 3600000
```

- When it returns with `blocked`, look at the screen with `herdr agent read <name> --source visible`
  - **Permission prompts for `git commit`, `gh pr create`, etc.**: tell the user "Press 1. Yes in workspace '<label>'" (**refer to it by the workspace label (the name given with `--label`) or the branch name. IDs like `w18` and agent/pane names do not appear on the user's screen**), check what the command contains (commit message, PR base and body) and add the key points. Then, in the background, run "wait until `working` → wait until it next stops"
  - **Prompts about a shell construct (zsh arrays, pipes, etc.) judged dangerous**: decline with `herdr agent send-keys <name> 2`, and tell the worker via prompt "run it again as a simple command that just lists the file paths"
- When it returns with `idle` / `done`, read `herdr agent read <name> --source visible` and the brief's "Result" section (while `blocked`, you can't read `recent-unwrapped`)
  - **`done` doesn't always mean finished**: if `shell still running` is shown at the bottom of the screen or "Result" is still "not started", the worker is waiting for background tests. Wait again with `--until working` → `--until idle/done/blocked`

## 5. Review the diff

- `git -C <worktree> status --short` and `git -C <worktree> rawdiff -M HEAD` (both staged and unstaged. In this user's setup `git diff` is difftastic, so use `rawdiff`, an alias for `git diff --no-ext-diff` defined in the user's git config). For stacked PRs, compare against the base PR's branch
  - **Don't run anything that changes the index of the worker's worktree (`git add`, `git add -N`, `git reset`, `git stash`)**. It breaks renames etc. that the worker staged. List new untracked files with `git -C <worktree> status --short` and inspect them with Read
- What to check: it matches the brief's "what is already decided", it doesn't violate the project's rules (e.g. `.claude/rules`, if present), the 3 test categories, whether spec changes are written in "Result", and no test failures other than known ones
- If there are problems, tell the worker the concrete fix via prompt and go back to 4
- If there are none, report a summary to the user (changes, what the worker verified, what to look at in manual testing) and tell the worker "commit, push, and create the PR with the create-pr skill" (don't include `.husky/_`, specify the base, don't reply to PR comments)

## 6. Once the PR exists

- Check **that the base is correct** with `gh pr list --head <branch> --json number,url,baseRefName` (for a stacked PR, it is the base PR's branch)
- Before manual testing, have the user check that the commit hash in the preview comment matches the PR's head
- The design session reads the AI reviewers' comments and shows the user the response plan and draft replies. When a fix is needed, delegate it to the worker with the same flow as 5
  - **The design session first writes the comment bodies to a file (e.g. `.ai_logs/.../review-comments/pr<n>.md`) with `gh api` and hands that to the worker**. If the worker reads them with `gh api`, the user gets a permission prompt every time
  - Have the worker write the reply drafts (not post them), and the design session compiles them into a single file to show the user. Fill in commit hashes after the push (the new hashes if the branch was rebuilt)
  - At every permission prompt, check that the PR body and commits contain no keywords that auto-close issues (covered in the common rules)
  - CodeRabbit's "outside diff" and "nitpick" items are in the review body, not inline (`body` of `gh api .../pulls/<n>/reviews`). Reply with a single PR comment (`issues/<n>/comments`)
  - **Post replies with one command per reply, joined with `&&`** (in zsh, word splitting such as `for p in "a b"; set -- $p` doesn't work and everything fails). Write the body to a file and use `-F body=@<file>`
  - When adding fixes to the brief, write an "Addressing AI review" section at the end of it and tell the worker to read it
- **Bringing a PR that has drifted from main up to date** (e.g. approved, before merge): have the worker run `git fetch origin` → `git merge origin/main` (don't rebase: no force push is needed and approvals stay. Verified on 2026-10-30 with two approved PRs)
  - First check for conflicts with `git merge-tree --write-tree --name-only origin/main origin/<branch>`
  - **If there are conflicts, stop once they're resolved (before the merge commit) and have the worker report how they were resolved**. The design session decides on the intent when both changes collide (e.g. whether to block a button added on main using this PR's mechanism)
  - Then have the worker run typecheck and the tests for the files changed in the PR and the tests that import them, write the results to a file, and only then push

### Stacked PRs (gh stack)

Handle them as GitHub stacked PRs with `gh stack` (a GitHub CLI extension; see the `gh-stack` skill for usage). **The design session performs `gh stack` operations; workers do not** (they rewrite branches across worktrees).

1. Create the upper layer's worktree from the lower PR's branch (`--base origin/<lower branch>`)
2. The worker creates the PR as usual with `gh pr create --base <lower branch>` (body per the create-pr skill; don't use `gh stack submit`, which generates the title and body automatically)
3. The design session assembles the stack in the main checkout. Always pass arguments/flags so that no interactive screen opens:
   ```sh
   gh stack init --base main <lower branch> <upper branch>   # adopt existing branches (local tracking)
   gh stack submit --auto                                    # fix the base of existing PRs and assemble the GitHub stack
   gh stack view --json                                      # verify
   ```
   **Start with `gh stack link <lower PR> <upper PR>`** (it assembles the stack through the API only, without checking out branches; the branches are held by the workers' worktrees). `init` tries to check out branches, so it can collide with the workers' worktrees. Once an operation that needs local tracking, such as `rebase`, becomes necessary, stop the workers and adopt the branches with `init` (verified on 2026-10-27 by linking two PRs into a stack). **When adding on top, list every PR in the stack from the bottom, including already-merged ones** (e.g. `gh stack link <PR1> <PR2> <PR3> <PR4>`; leaving one out is rejected with a message that PR1 would be dropped). A 422 warning appears when it tries to repoint the base to the branch of an already-merged PR, but it is harmless (no repointing happens). After running, check each PR's base with `gh pr view`
4. **When the lower PR gets fixes**, after making sure both workers are stopped (worktrees clean):
   ```sh
   gh stack rebase   # rebase from the bottom; the worktrees holding each branch are updated too
   gh stack push     # push with --force-with-lease
   ```
   - Force-pushing is allowed **only with `--force-with-lease` after rebasing a stacked PR with `gh stack`** (2026-10-27, by the user). No other force pushes or amends
   - On a conflict (exit code 3), resolve it in the reported worktree and run `gh stack rebase --continue`. If unsure, `--abort` and tell the user
5. **When the lower PR is merged** (squash): GitHub rebases the upper PR server-side and changes its base to main (confirmed on 2026-10-27 with a two-PR stack; no `gh stack` operation was needed). Check the base, head and commits with `gh pr view <upper PR> --json baseRefName,headRefOid,commits`, and tell the user to wait for the preview to be rebuilt because the head changed. The worker's local copy drifts from origin, so before having it continue, get the user's confirmation and align it with `git -C <worktree> fetch` → `reset --hard origin/<branch>` (first make sure the only uncommitted changes are the links). If you are tracking locally (`init`), use `gh stack sync` (it detects the squash, rebases with `--onto`, and pushes). Check that the upper PR's base has become main with `gh stack view --json` and `gh pr view`
6. **When the upper PR shows "conflict"**: a GitHub stacked PR checks mergeability not only against its base but also **against main**. Check with `git merge-tree --write-tree --name-only origin/main origin/<branch>` whether the conflict is with main. To fix it, after making sure the workers are stopped (worktrees clean), the design session rebases each worktree from the bottom (`git -C <lower worktree> rebase origin/main`; for the upper one, `git -C <upper worktree> rebase --onto <new lower branch> <old lower head>`). Run typecheck on each branch and the tests on the top one, then push from the bottom with `git push --force-with-lease=<branch>:<old head> origin <branch>` (2026-10-28, permitted by the user; don't use `gh stack init`, which can collide with the worktrees)
7. The user merges on the web UI. Don't use `gh stack merge` (when asked to, add `<PR number> --yes`)

## 7. Cleanup

- Once the PR is merged, with the user's agreement, remove the worktree with `herdr worktree remove --workspace <workspace_id>`
  - The linked `.husky/_` remains as an untracked file, so removal is refused with `dirty_worktree_requires_force`. Check with `git -C <worktree> status --short` that **only the links remain**, and with `git -C <worktree> log --oneline @{u}..HEAD` that there are no unpushed commits, then remove with `--force` (removing links doesn't delete their targets)
  - If changes other than the links remain, don't remove it; tell the user
- Update the brief's "Result" and the project index (progress, PR numbers)
