# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Personal macOS dotfiles managed with GNU Stow. Each top-level directory is a stow
package whose internal layout mirrors its install target, so a file's path inside the
package is its path relative to the target (e.g. `zsh/.config/zsh/.zshrc` →
`~/.config/zsh/.zshrc`). Because files are symlinked, edits here take effect on this
machine immediately.

Stow targets (defined in `run_stow` in `up`):

- `$HOME`: `alacritty any-script-mcp bat gh git herdr hunk nvim runok starship zsh`, plus `bin` (→ `~/.local/bin`)
- `~/.claude`: `claude`
- `~/scripts`: `scripts`
- `~/Library/Application Support/{Code,Cursor}/User`: `vscode`, `cursor`

A new package must be added to `run_stow` and to `stowTargets` in
`scripts/doctor.ts` (`doctor.test.ts` fails if they differ). If it holds runtime or machine-local files,
`mkdir -p` its config dir first so stow doesn't tree-fold the whole directory into the
repo (see the comment in `run_stow`).

`bin/.local/bin/*` are thin bash wrappers that `exec bun ~/dotfiles/scripts/<name>.ts`;
the logic lives in `scripts/`.

## Commands

```bash
./up              # full setup: brew + sheldon + stow + yarn globals
./up dot          # re-create symlinks only (STOW_VERBOSE=1 for more output)
./up brew         # brew bundle --file=Brewfile.shared + VS Code extensions
./up macos        # apply macOS defaults from scripts/macos_defaults.ts
./up doctor       # read-only check: brew, VS Code extensions, stow links, defaults

bun install
bun typecheck                     # tsc over scripts/**/*.ts and claude/**/*.ts
bun test                          # all *.test.ts
bun test claude/scripts/block-push-to-main.test.ts   # single file
bun test -t "<name pattern>"      # single test

runok test -c runok/.config/runok/runok.yml          # runok rule tests
runok check -- <command>                             # see how a command is judged
/bin/bash ./claude/test_create_worktree.sh           # must pass on bash 3.2
bash claude/test_statusline.sh                       # visual check of the statusline
```

CI (`.github/workflows/ci.yml`) runs typecheck, `bun test`, the runok rule tests, the
create-worktree test on ubuntu and macOS, sheldon, and stow against an empty `$HOME`.
The `brew install` job only runs when `Brewfile.shared` changes.
`scripts/nvim_config.test.ts` runs only locally (it needs `nvim` and the plugins from
`lazy-lock.json`) and is skipped in CI.

## Claude Code config (`claude/` → `~/.claude`)

- `claude/CLAUDE.md` is the user's **global** CLAUDE.md, not this repo's. Edits to it
  apply to every project.
- `claude/settings.json` sets hooks, the statusline (`bun ~/.claude/statusline.ts`), plugins and MCP servers.
- `claude/skills/*` are user-level skills.
- **PreToolUse has exactly one entry: `claude/scripts/pre-tool-use-proxy.sh`.** If
  several PreToolUse entries match, Claude Code drops `updatedInput` and runok's sandbox
  rewrite is lost. Add new guards as a `run_hook` call inside the proxy, not as another
  settings entry. Current routing:
  - Edit/Write → `block-edit-on-main.ts` (denies edits on main/master; git-ignored files such as `.ai_logs/` are allowed)
  - Bash → `block-push-to-main.ts`, `block-issue-close-keywords.ts`, then `runok hook`
- Hook stderr is discarded. Hooks log to `~/.claude/logs/<user>-hook-*.log`. When a
  guard can't run, the proxy returns `ask` (never pass or deny).
- These hooks are live through symlinks. A syntax error blocks every tool call, and
  you can't recover from that inside the session. Test changes on a copy (the `*.test.ts`
  files run the real scripts with stubbed tools) before editing the live file.
- Hook guards are TypeScript run by bun, sharing helpers in `claude/scripts/lib/`.
  Each one has a matching `*.test.ts`.

## runok (`runok/.config/runok/`)

Bash permission rules. `runok.yml` extends `github:fohte/runok-presets/base@v1`,
`git.yml` and `tools.yml`. `defaults.action: pass` sends unmatched commands to
Claude Code's own permission flow. Add inline `tests:` next to each rule you add. runok
is built from HEAD and installed by hand (not via the Brewfile); see README.

## Gotchas

- Don't add VS Code extensions to `Brewfile.shared`. They go in `vscode-extensions.txt`
  and are installed one at a time (concurrent installs race, #172).
- `runok` and `alacritty` are intentionally absent from `Brewfile.shared` (see README).
  Don't run `brew bundle cleanup --force`.
- `kube` in `.zshrc` is an internal CLI, not a typo of `kubectl`.
