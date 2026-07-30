---
name: gh-pr-review-comments
description: Post GitHub PR review comments with inline comments via `gh api` without hitting HTTP 422. Use when creating a PR review that attaches line-level comments through the GitHub API (repos/{owner}/{repo}/pulls/{N}/reviews), or when a `gh api` review request fails with 422 / "Unprocessable Entity".
---

# GitHub PR Review Comments via API

When posting PR review comments with inline comments using `gh api`, follow these rules to avoid HTTP 422 errors:

1. **Use `--input` (not `--field`)** for the request body — `--field` cannot handle nested JSON arrays like `comments`
2. **Always include `commit_id`** — resolve it first with `gh pr view {N} --json headRefOid --jq '.headRefOid'`
3. **Always include `"side": "RIGHT"` on each comment** — tells GitHub the comment targets the new (post-change) side of the diff
4. **Write JSON payload to a temp file** — avoids shell escaping issues with inline heredocs

```bash
# Template
COMMIT_SHA=$(gh pr view {N} --json headRefOid --jq '.headRefOid')

# Write JSON to file (use Write tool, not heredoc, to avoid escaping issues)
# Required fields in JSON:
# {
#   "commit_id": "<COMMIT_SHA>",
#   "event": "COMMENT",
#   "body": "Review summary",
#   "comments": [
#     { "path": "file.ts", "line": 42, "side": "RIGHT", "body": "Comment" }
#   ]
# }

gh api repos/{owner}/{repo}/pulls/{N}/reviews \
  --method POST \
  --input /tmp/pr-review.json
```
