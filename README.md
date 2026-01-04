# Dotfiles

Personal macOS configuration files managed with [GNU Stow](https://www.gnu.org/software/stow/).

## Quick Start

```bash
# Clone this repository
git clone git@github.com:chloe463/dotfiles.git
cd dotfiles

# For private machine
git checkout private

# For work machine
git checkout work

# Run full setup
./up
```

## Usage

### Setup Commands

```bash
# Full setup (brew + dotfiles + zprezto + npm + tmux)
./up

# Individual components
./up brew      # Install Homebrew packages
./up dot       # Create symlinks only
./up zprezto   # Install Zsh framework
./up npm       # Install global npm packages
./up tmux      # Install tmux plugins

# Debug mode (verbose stow output)
STOW_VERBOSE=1 ./up dot
```

### Managing Dotfiles

#### Adding Shared Configuration (All Machines)

```bash
# Create feature branch
git checkout main
git checkout -b feature/add-config

# Make changes
nvim zsh/.zshrc

# Commit and create PR
git add .
git commit -m "feat(zsh): add new alias"
git push -u origin feature/add-config
gh pr create

# After PR merge, sync to machine branches
./scripts/sync-branches.sh
```

#### Adding Machine-Specific Configuration

```bash
# Private machine only
git checkout private
echo 'brew "personal-tool"' >> Brewfile.private
git commit -am "feat(brew): add personal tools"
git push

# Work machine only
git checkout work
echo 'brew "company-vpn"' >> Brewfile.work
git commit -am "feat(brew): add company tools"
git push
```

See [docs/MULTI_MACHINE_WORKFLOW.md](docs/MULTI_MACHINE_WORKFLOW.md) for detailed workflow guide.

## Multi-Machine Support

This repository uses a Git branching strategy to support multiple machines:

- **main** - Shared configurations (requires PR)
- **private** - Private machine specific configs
- **work** - Work machine specific configs

### Machine-Specific Files

Use `Brewfile.private` and `Brewfile.work` to manage machine-specific packages:

```bash
# On private machine
brew bundle --file=Brewfile.private

# On work machine
brew bundle --file=Brewfile.work
```

## Prerequisites

- macOS (tested on macOS Sonoma)
- Xcode Command Line Tools: `xcode-select --install`
- Git: `brew install git` (or comes with Xcode tools)
- GNU Stow: `brew install stow`

## Tools & Workflows

### Git Sync Script
Automatically sync main/master and cleanup merged branches:
```bash
git sync  # Runs ~/scripts/git_sync.sh
```

### Branch Sync Script
Sync main branch changes to machine branches:
```bash
./scripts/sync-branches.sh
```

### Brewfile Management
```bash
# Install all shared packages
brew bundle --file=Brewfile.shared

# Private machine
brew bundle --file=Brewfile.private

# Work machine
brew bundle --file=Brewfile.work

# Update lock file
brew bundle dump --force
```

## Troubleshooting

### Stow Conflicts

If stow reports conflicts:
```bash
# Check error log
cat /tmp/stow.log

# Remove conflicting files
rm ~/.zshrc  # or backup first

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

