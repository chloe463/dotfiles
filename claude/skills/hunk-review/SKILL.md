---
name: hunk-review
description: Loads Hunk's own diff-review skill dynamically via `hunk skill path`, so live Hunk review sessions (session list/get/review/navigate/comment) can be inspected and annotated without hardcoding a version-specific path. Use when the user has a Hunk session running or wants to review diffs interactively with Hunk.
---

# Hunk Review

This is a thin wrapper around [Hunk](https://github.com/modem-dev/hunk)'s own
agent instructions. Hunk ships a `SKILL.md` describing how to inspect and
control live review sessions, but it lives under the installed binary's path
(e.g. `/opt/homebrew/Cellar/hunk/<version>/libexec/skills/hunk-review/SKILL.md`),
which shifts on every version bump. Resolving it dynamically avoids pinning a
path that will go stale.

## What to do

1. Run `hunk skill path` to get the current path to Hunk's own `SKILL.md`.
2. Read that file.
3. Follow its instructions for the rest of the review: inspecting live
   sessions, navigating files/hunks, and leaving comments via `hunk session *`
   commands.

Do not run `hunk diff`, `hunk show`, or other interactive commands yourself —
those are for the user's own terminal. Only use `hunk session *` commands, as
directed by the loaded skill.

## Notes

- If `hunk skill path` fails, or the file it points to doesn't exist, tell the
  user rather than guessing at the workflow — Hunk may not be installed, or
  was installed without its skill files.
- Don't duplicate Hunk's instructions here. Always defer to whatever
  `hunk skill path` resolves to at run time, so this wrapper keeps working
  across Hunk version upgrades.
