# Dotfiles

Personal macOS configuration files managed with [GNU Stow](https://www.gnu.org/software/stow/).

## Quick Start

```bash
# Clone this repository
git clone git@github.com:YOUR_USERNAME/dotfiles.git
cd dotfiles

# For private machine
git checkout private

# For work machine
git checkout work

# Run full setup
./up
```

## What's Included

### Shell & Terminal
- **Zsh** - Shell with Prezto framework (162 lines of config)
- **Tmux** - Terminal multiplexer
- **Alacritty** - GPU-accelerated terminal emulator
- **Starship** - Cross-shell prompt

### Editors
- **Neovim** - Modern Vim (33 Lua config files, LSP, Treesitter)
- **VSCode** - 47 extensions pre-configured
- **Cursor** - AI-powered editor
- **Vim** - Classic editor

### Development Tools
- **Git** - Version control with 24 custom aliases
- **GitHub CLI** (gh) - GitHub from command line
- **gh-dash** - GitHub dashboard in terminal

### Utilities
- **bat** - Better cat with syntax highlighting
- **fzf** - Fuzzy finder
- **ripgrep** - Fast grep alternative
- **fd** - Fast find alternative
- **direnv** - Environment variable manager
- **ghq** - Repository management

### Package Management
- **Homebrew** - macOS package manager
- **Brewfile** - 60+ packages, 13 taps, managed declaratively

## Repository Structure

```
dotfiles/
├── alacritty/      # Terminal emulator config + 4 color schemes
├── bat/            # Syntax highlighting config
├── btt/            # BetterTouchTool settings
├── claude/         # Claude Code CLI settings
├── cursor/         # Cursor editor settings
├── gh/             # GitHub CLI config
├── gh-dash/        # GitHub dashboard config
├── git/            # Git config with aliases + functions
├── nvim/           # Neovim (33 files, Lazy plugin manager)
├── prompts/        # Shell prompt themes
├── scripts/        # Utility scripts
│   ├── git_sync.sh          # Sync and cleanup git branches
│   └── sync-branches.sh     # Sync main → private/work branches
├── starship/       # Cross-shell prompt
├── tmux/           # Terminal multiplexer
├── vim/            # Vim config
├── vscode/         # VSCode settings + extensions
├── zsh/            # Zsh + Prezto framework
├── docs/           # Documentation
│   └── MULTI_MACHINE_WORKFLOW.md  # Multi-machine guide
├── Brewfile.shared    # Shared packages
├── Brewfile.private   # Private machine packages
├── Brewfile.work      # Work machine packages
└── up              # Bootstrap script
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

## Highlights

### Shell (Zsh + Prezto)
- 9 Prezto modules enabled
- 6 custom utility functions
- FZF integration with Ctrl+F/Ctrl+B bindings
- Version managers: rbenv, nodenv, goenv, direnv
- Multiple Python versions (3.8-3.12)

### Git Configuration
- 24 custom aliases (typo-resistant: `puhs`, `psuh`, `comit`)
- `git sync` - Auto-sync and cleanup branches
- `git cof` / `git cofzf` - FZF branch switching
- git-split-diffs pager with arctic theme
- Custom log formats (logg, mergelog, history)

### Neovim Setup
- Lua-based configuration
- Lazy plugin manager
- LSP with lspsaga
- Treesitter syntax highlighting
- File explorer: neo-tree
- Git integration: git-blame
- Auto-pairs, autotag
- Multiple colorschemes

### Terminal (Alacritty)
- GPU-accelerated
- 4 color schemes: Catppuccin, Nord, Iceberg, Tokyo Night
- Font: MonaspaceNeon Nerd Font (size 14)

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

## Configuration

### Stow Packages

Standard packages (symlinked to `~`):
- alacritty, bat, gh, git, nvim, starship, tmux, vim, zsh

macOS app configs (custom targets):
- VSCode → `~/Library/Application Support/Code/User`
- Cursor → `~/Library/Application Support/Cursor/User`
- Claude → `~/.claude`

Scripts:
- scripts → `~/scripts`

The `up` script automatically detects which apps are installed and only creates symlinks for available applications.

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

## Development

### CI/CD

GitHub Actions runs on every push to test:
- Zprezto installation
- Stow symlink creation

See `.github/workflows/ci.yml`

### Analysis Logs

AI-generated analysis and planning documents are stored in `.ai_logs/`:
- `20251230_up_script_refactoring.md` - Recent up script improvements
- `20251230_todo_improvements.md` - Future improvement roadmap

These files are gitignored and for local reference only.

## Contributing

This is a personal dotfiles repository, but feel free to:
- Fork and use as inspiration
- Open issues for bugs
- Submit PRs for improvements

## License

MIT - Feel free to use any configuration you find useful.

## Resources

- [GNU Stow Manual](https://www.gnu.org/software/stow/manual/stow.html)
- [Prezto](https://github.com/sorin-ionescu/prezto)
- [Awesome Dotfiles](https://github.com/webpro/awesome-dotfiles)
- [docs/MULTI_MACHINE_WORKFLOW.md](docs/MULTI_MACHINE_WORKFLOW.md)
