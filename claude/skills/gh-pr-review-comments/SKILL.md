---
name: gh-pr-review-comments
description: Post GitHub PR review comments with inline comments via `gh api` without hitting HTTP 422. Use when creating a PR review that attaches line-level comments through the GitHub API (repos/{owner}/{repo}/pulls/{pull_number}/reviews), or when a `gh api` review request fails with 422 / "Unprocessable Entity".
---

# GitHub PR Review Comments via API

Posting a review with inline comments through `gh api` fails with 422 or 404 unless every rule below holds.

## Rules

1. **`line` must fall inside a hunk of the PR diff.** This is the most common cause of 422. Only the added, removed, and context lines that actually appear in the diff are addressable — a line that exists in the file but not in the diff is rejected. Confirm line numbers against `gh pr diff <N>` before writing the payload.
2. **`side` depends on which version of the line the comment targets.** Use `"RIGHT"` for added and context lines (the post-change file) and `"LEFT"` for removed lines, which do not exist in the new file. `"RIGHT"` with a line number that only exists on the old side is a 422.
3. **`commit_id` is required** and must be the PR head SHA. Resolve it as its own step (below) — never leave a placeholder in the JSON.
4. **Use `--input <file>`, not `--field`.** `--field` cannot express the nested `comments` array.
5. **`gh api` substitutes only `{owner}`, `{repo}`, and `{branch}`.** Every other brace pair is sent literally and yields a 404, so the PR number must be interpolated by the shell. `gh pr view` and `gh pr diff` perform no substitution at all.

## Procedure

### 1. Resolve the head SHA

Run this and read the output:

```bash
gh pr view 177 --json headRefOid --jq '.headRefOid'
```

The SHA has to be pasted literally in step 2. The Write tool does not share the shell environment, and shell state is not preserved between Bash calls, so assigning it to a variable here cannot reach the JSON.

### 2. Write the payload

Write the file with the Write tool rather than a heredoc, to avoid shell escaping issues. Put it at `.ai_logs/pr<N>-review.json` — per CLAUDE.md temporary files belong in `.ai_logs`, which is gitignored, and `list_ai_logs.rb` globs only `*.md` so the payload never shows up in the log listing. The PR number in the filename keeps concurrent reviews from overwriting each other.

Paste the 40-character SHA from step 1 into `commit_id`:

```json
{
  "commit_id": "3f8a1c9e2b7d4a6f0c5e8b1d9a3f7c2e4b6d8a0f",
  "event": "COMMENT",
  "body": "Review summary",
  "comments": [
    { "path": "src/app.ts", "line": 42, "side": "RIGHT", "body": "Comment on an added or context line" },
    { "path": "src/old.ts", "line": 17, "side": "LEFT", "body": "Comment on a removed line" }
  ]
}
```

### 3. Post the review

```bash
PR=177
gh api "repos/{owner}/{repo}/pulls/${PR}/reviews" \
  --method POST \
  --input ".ai_logs/pr${PR}-review.json"
```

`gh` fills in `{owner}` and `{repo}` from the current repository; `${PR}` is expanded by the shell.

## Multi-line comments

To span a range, add `start_line` and `start_side` next to `line` and `side`. `start_line` must be smaller than `line`, and both endpoints must sit inside the same hunk.
