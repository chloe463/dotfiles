# Multi-Machine Workflow Guide

This repository supports managing dotfiles across multiple machines (private and work) using a Git branching strategy.

## Branch Structure

```
main          (protected, shared configs, requires PR to update)
├── private   (tracks main + private-specific overrides)
└── work      (tracks main + work-specific overrides)

feature/*     (temporary branches for PRs to main)
```

## Quick Start

### First-Time Setup

#### On Your Private Machine

```bash
# Clone the repository
git clone git@github.com:chloe463/dotfiles.git
cd dotfiles

# Checkout private branch
git checkout private

# Run setup
./up
```

#### On Your Work Machine

```bash
# Clone the repository
git clone git@github.com:chloe463/dotfiles.git
cd dotfiles

# Checkout work branch
git checkout work

# Run setup
./up
```

## Daily Workflows

### Scenario 1: Adding Shared Configuration

When you want to add a config that should be on ALL machines:

```bash
# Start from main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/add-tmux-plugin

# Make changes
# Edit tmux/.tmux.conf or any shared config

# Commit
git add .
git commit -m "feat(tmux): add new plugin"

# Push and create PR
git push -u origin feature/add-tmux-plugin
gh pr create --base main

# After PR is merged, sync to machine branches
./scripts/sync-branches.sh
```

### Scenario 2: Adding Private-Only Configuration

When you want to add something ONLY to your private machine:

```bash
# Work directly on private branch
git checkout private

# Make changes (e.g., add personal tools to Brewfile)
echo 'brew "personal-tool"' >> Brewfile.private

# Commit directly
git add Brewfile.private
git commit -m "feat(brew): add personal development tools"

# Push
git push origin private

# No sync needed - this stays on private only
```

### Scenario 3: Adding Work-Only Configuration

Same as private, but on work branch:

```bash
# Work directly on work branch
git checkout work

# Make changes
echo 'brew "company-vpn"' >> Brewfile.work

# Commit
git add Brewfile.work
git commit -m "feat(brew): add company tools"

# Push
git push origin work
```

### Scenario 4: Fixing a Bug Found on Any Machine

```bash
# From any branch, go back to main
git checkout main
git pull origin main

# Create fix branch
git checkout -b fix/zsh-path-issue

# Fix the bug in shared config
# Edit zsh/.zshrc

# Commit
git add .
git commit -m "fix(zsh): correct PATH order for homebrew"

# Push and create PR
git push -u origin fix/zsh-path-issue
gh pr create --base main

# After merge, sync
./scripts/sync-branches.sh
```

## Syncing Branches

After any PR is merged to `main`, run the sync script to update machine branches:

```bash
./scripts/sync-branches.sh
```

This script will:
1. Update `main` from remote
2. Merge `main` into `private` branch
3. Merge `main` into `work` branch
4. Return you to your original branch

If there are merge conflicts, it will stop and ask you to resolve them manually.

## Machine-Specific Files

### Brewfile Strategy

- `Brewfile.shared` - Core packages for all machines (git, neovim, tmux, etc.)
- `Brewfile.private` - Private machine packages (extends shared)
- `Brewfile.work` - Work machine packages (extends shared)
- `Brewfile` - Main Brewfile (currently set to shared, can be symlinked per branch)

#### Using Machine-Specific Brewfiles

On private machine:
```bash
# Install using private Brewfile
brew bundle --file=Brewfile.private
```

On work machine:
```bash
# Install using work Brewfile
brew bundle --file=Brewfile.work
```

### Git Config

- `git/.config/git/config` - Shared git config tracked in repo
- Same git account used on all machines (no per-machine overrides needed)

## File Organization

### What Goes in Each Branch?

**main branch** (shared):
- Core shell configs: `.zshrc`, `.zshenv`, `.tmux.conf`
- Editor configs: `nvim/`, `vscode/`
- Tool configs: `alacritty/`, `starship/`, `bat/`
- Shared Brewfile: `Brewfile.shared`
- Scripts: `scripts/`
- Git base config: `git/.config/git/config`

**private branch** (overrides):
- Machine-specific Brewfile: `Brewfile.private`
- Any private-only scripts or configs
- Documentation of private-specific setup

**work branch** (overrides):
- Machine-specific Brewfile: `Brewfile.work`
- Any work-only scripts or configs
- Documentation of work-specific setup

**NOT tracked** (in .gitignore):
- `.ai_logs/` - AI analysis and planning files
- Temporary/backup files

## Troubleshooting

### Merge Conflicts When Syncing

If `sync-branches.sh` reports conflicts:

```bash
# You'll be on the conflicted branch
git status  # See what's conflicted

# Edit conflicted files
nvim path/to/conflicted/file

# Mark as resolved
git add .
git commit

# Push the resolved merge
git push

# Continue syncing other branch if needed
git checkout work  # or private
git merge main
git push
```

### Accidentally Committed to main

If you committed directly to main instead of creating a feature branch:

```bash
# Undo the commit but keep changes
git reset HEAD~1

# Create feature branch
git checkout -b feature/my-change

# Recommit
git add .
git commit -m "feat: my change"

# Push
git push -u origin feature/my-change

# Create PR
gh pr create
```

### Want to Test Changes on Both Machines Before PR

```bash
# Create feature branch from main
git checkout main
git checkout -b feature/test-change

# Make changes and commit
git add .
git commit -m "feat: testing new config"

# Push
git push -u origin feature/test-change

# On private machine
git fetch
git checkout feature/test-change
./up dot  # Test

# On work machine
git fetch
git checkout feature/test-change
./up dot  # Test

# If good, create PR to main
gh pr create --base main
```

## Best Practices

1. **Always use PRs for main** - Never commit directly to main
2. **Keep commits atomic** - One logical change per commit
3. **Sync regularly** - Run `sync-branches.sh` after each main merge
4. **Test before merging** - Test configs before creating PR
5. **Document machine-specific** - Add comments explaining why something is work/private only
6. **Use conventional commits** - feat, fix, docs, refactor, etc.
7. **Review your changes** - Use `git diff` before committing

## Tips

### View Branch Differences

```bash
# See what's different between branches
git log main..private --oneline
git log main..work --oneline

# See file differences
git diff main..private
```

### Keep Branch History Clean

```bash
# Regularly check status
git log --oneline --graph --all --decorate

# Keep branch structure visible
git branch -vv
```

### Automate Setup on New Machine

```bash
# Full automated setup
git clone git@github.com:chloe463/dotfiles.git
cd dotfiles
git checkout private  # or work
./up
```

## Migration Notes

If you were using direct commits to main before this workflow:

1. All existing commits in `main` are preserved
2. `private` and `work` branches start as copies of `main`
3. Going forward, use the PR workflow for main
4. Add machine-specific configs to respective branches

