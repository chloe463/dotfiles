# Dotfiles

Personal macOS configuration files managed with [GNU Stow](https://www.gnu.org/software/stow/).

## Quick Start

### Automated Setup (Recommended)

Use the bootstrap script for one-command setup on a fresh machine:

```bash
# Remote installation (easiest)
curl https://raw.githubusercontent.com/chloe463/dotfiles/refs/heads/main/bootstrap | bash

# Or clone and run locally
git clone git@github.com:chloe463/dotfiles.git ~/dotfiles
cd ~/dotfiles
./bootstrap
```

The bootstrap script will:
1. Clone this repository to `~/dotfiles` (tries SSH, falls back to HTTPS)
2. Run the `up` script to install everything

### Manual Setup

```bash
# Clone this repository
git clone git@github.com:chloe463/dotfiles.git
cd dotfiles

# Run full setup
./up
```

## Usage

### Bootstrap Script Options

```bash
# Standard usage (clone + setup)
./bootstrap

# Clone only, skip setup (useful for testing)
./bootstrap --skip-up
```

### Setup Commands

```bash
# Full setup (brew + dotfiles + sheldon + npm)
./up

# Individual components
./up brew      # Install Homebrew packages
./up dot       # Create symlinks only
./up sheldon   # Install Zsh plugins
./up npm       # Install global npm packages
./up macos     # Apply macOS defaults (scripts/macos_defaults.ts)
./up doctor    # Check packages, symlinks and macOS defaults (read-only)

# Debug mode (verbose stow output)
STOW_VERBOSE=1 ./up dot
```

`macos` and `doctor` run with [bun](https://bun.sh), which isn't installed by
`./up`. `./up macos` isn't part of the full setup; run it once after `./up`.

### Checking the Setup

`./up doctor` reports what doesn't match the repo and exits 1 if anything fails:

- packages in `Brewfile.shared` that aren't installed (outdated ones are
  ignored); fails if `brew` itself is missing
- extensions in `vscode-extensions.txt` that aren't installed; fails if the
  `code` command is missing, since VS Code is in `Brewfile.shared`
- stow symlinks that aren't created yet, or conflicts (`stow -n` dry run).
  Cursor's links are skipped when Cursor isn't installed or its settings
  directory doesn't exist
- test files reachable from the stow targets (see below)
- macOS `defaults` that differ from `scripts/macos_defaults.ts` (apps that
  aren't installed are skipped; if the app lookup itself fails, it's reported
  as a failure)

Add a new macOS setting to `SETTINGS` in `scripts/macos_defaults.ts`; both
`./up macos` and `./up doctor` pick it up.

### Test Files Are Not Linked

Tests (`*.test.ts`, `test_*.sh`, at any depth) are only run from the repo,
so `.stowrc` tells stow to ignore them. The packages that hold tests,
`claude` and `scripts`, are stowed with `--no-folding`; otherwise stow could
link a whole directory such as `~/.claude/scripts` and the tests with it.
As a result, a file added to those packages needs `./up dot` to be linked.

A machine stowed before `.stowrc` existed needs a one-time cleanup, which
`./up doctor` points out:

- folded directories (e.g. `~/.claude/scripts` as a single link): `./up dot`
  replaces them with real directories
- links to test files: stow doesn't unstow files it ignores, so remove these
  by hand

### Managing Dotfiles

#### Adding Configuration

```bash
# Create feature branch
git checkout main
git checkout -b feature/add-config

# Make changes
nvim zsh/.config/zsh/.zshrc

# Commit and create PR
git add .
git commit -m "feat(zsh): add new alias"
git push -u origin feature/add-config
gh pr create
```

## Prerequisites

- macOS (tested on macOS Sonoma)
- Xcode Command Line Tools: `xcode-select --install`
- Git: `brew install git` (or comes with Xcode tools)
- GNU Stow: `brew install stow`

## Package Structure

| Package | Stow target | Purpose |
|---------|-------------|---------|
| `alacritty`, `bat`, `gh`, `git`, `nvim`, `starship`, `zsh` | `$HOME` | Shell and tool configs |
| `any-script-mcp` | `$HOME` | Claude Code MCP tool config (`~/.config/any-script-mcp/`) |
| `claude` | `$HOME/.claude` | Claude Code settings, hooks, skills |
| `hunk` | `$HOME` | hunk diff viewer config (`~/.config/hunk/config.toml`) |
| `vscode` | `~/Library/Application Support/Code/User` | VS Code settings |
| `cursor` | `~/Library/Application Support/Cursor/User` | Cursor settings |
| `scripts` | `~/scripts` | Implementation scripts |
| `bin` | `$HOME` | Public CLI commands (symlinked into `~/.local/bin`) |

The `bin` package exposes user-facing commands via `~/.local/bin` (XDG-compliant), keeping the public interface stable and separate from internal implementation under `scripts/`.

## Tools & Workflows

### Git Sync Script
Automatically sync main/master and cleanup merged branches:
```bash
git-sync        # Runs ~/.local/bin/git-sync
git sync        # Git alias (same script)
```

### Brewfile Management
```bash
# Install all shared packages
brew bundle --file=Brewfile.shared
```

VS Code extensions are listed in `vscode-extensions.txt` and installed one at
a time by `./up brew` (not via `brew bundle`'s `vscode` entries, which install
concurrently and race on `~/.vscode/extensions/` — see #172).

Alacritty is not in `Brewfile.shared`: Homebrew disabled the `alacritty` cask
on 2026-09-01 because it doesn't pass the Gatekeeper check. Install it from the
[GitHub releases](https://github.com/alacritty/alacritty/releases) instead; the
`alacritty` stow package still provides its config.

runok is not in `Brewfile.shared` either. Claude Code's Bash permissions depend
on it (`claude/scripts/pre-tool-use-proxy.sh` asks for confirmation on every
Bash call while it's missing), so install it by hand:

```bash
brew tap fohte/tap
brew trust --tap fohte/tap
brew install --HEAD fohte/tap/runok
```

It's built from HEAD because the Claude Code integration (`runok hook`,
`defaults.action: pass`) isn't in a release yet. It's kept out of the Brewfile
because tapping `fohte/tap` fails Homebrew's tap validation (the formula exits
on Intel macOS while loading), which breaks `brew bundle`. Since it isn't
listed, `brew bundle cleanup --file=Brewfile.shared` reports runok as
removable; don't pass `--force` without dropping it from the list.

## Troubleshooting

### Stow Conflicts

If stow reports conflicts:
```bash
# Check error log
cat /tmp/stow.log

# Remove conflicting files
rm ~/.config/zsh/.zshrc  # or backup first

# Re-run stow
./up dot
```

### Broken Symlinks

```bash
# Find broken symlinks in home directory
find ~ -maxdepth 1 -type l -exec test ! -e {} \; -print

# Remove specific broken link
rm ~/.broken-link
```

### Git Config Not Working

```bash
# Verify config is loaded
git config --list --show-origin | grep config.local

# Check if config.local exists
ls -la ~/.config/git/config.local

# If missing, create from template
cp git/.config/git/config.local.template ~/.config/git/config.local
```

