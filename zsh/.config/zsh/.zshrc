####################################################################################################
# Zsh options (previously managed by Prezto modules)
####################################################################################################
# editor module: emacs key bindings
bindkey -e

# directory module: cd convenience options
setopt AUTO_CD
setopt AUTO_PUSHD
setopt PUSHD_IGNORE_DUPS
setopt PUSHD_SILENT

# environment module
setopt COMBINING_CHARS
setopt INTERACTIVE_COMMENTS

####################################################################################################
# Other util settings
####################################################################################################
# Credentials, such as GitHub token, must be written in the following file
[ -f "$ZDOTDIR/credentials.zsh" ] && source "$ZDOTDIR/credentials.zsh"

# Configure fzf (shell integration generated on the fly; no stored ~/.fzf.zsh).
# `fzf --zsh` requires fzf >= 0.48.0; warn instead of failing silently on older versions.
if command -v fzf > /dev/null 2>&1; then
  if fzf_init=$(fzf --zsh 2>/dev/null); then
    source <(print -r -- "$fzf_init")
  else
    print -u2 "[zshrc] WARNING: 'fzf --zsh' failed (requires fzf >= 0.48.0); fzf integration not loaded."
  fi
  unset fzf_init
fi

####################################################################################################
# Aliases
####################################################################################################
alias cat='bat'
alias g='git'
alias be='bundle exec'
alias ls='eza --group-directories-first --icons'
alias vim='nvim'
alias top='btop'

####################################################################################################
# Environment variables
####################################################################################################
export PSQL_EDITOR='vim +"set syntax=sql" '
export EDITOR=/usr/bin/vim
export BUN_INSTALL="$HOME/.bun"

# For ffi
export LIBFFI_ROOT=$(brew --prefix libffi)
export LDFLAGS="-L$LIBFFI_ROOT/lib $LDFLAGS"
export PKG_CONFIG_PATH="$PKG_CONFIG_PATH:$LIBFFI_ROOT/lib/pkgconfig"

####################################################################################################
# PATH Configuration
####################################################################################################
# Helper function to prepend to PATH (adds to beginning, checked first)
# Only adds if directory exists and not already in PATH
path_prepend() {
  local dir="$1"
  # Expand tilde and check if directory exists
  dir="${dir/#\~/$HOME}"
  if [[ -d "$dir" ]] && [[ ":$PATH:" != *":$dir:"* ]]; then
    PATH="$dir:$PATH"
  fi
}

# Helper function to append to PATH (adds to end, checked last)
# Only adds if directory exists and not already in PATH
path_append() {
  local dir="$1"
  # Expand tilde and check if directory exists
  dir="${dir/#\~/$HOME}"
  if [[ -d "$dir" ]] && [[ ":$PATH:" != *":$dir:"* ]]; then
    PATH="$PATH:$dir"
  fi
}

# Build PATH in priority order (first = highest priority)
# User binaries (highest priority)
path_prepend "$HOME/bin"
path_prepend "$HOME/scripts"

# Language version managers
path_prepend "$GOENV_ROOT/bin"
path_prepend "$HOME/go/1.19.0/bin"  # TODO: Make Go version dynamic

# Development tools
path_prepend "$LIBFFI_ROOT/bin"
path_prepend "/opt/homebrew/opt/openjdk/bin"
path_prepend "$HOME/.console-ninja/.bin"

# Additional tools (lower priority, appended)
path_append "/Applications/Postgres.app/Contents/Versions/latest/bin"
path_append "$HOME/.local/bin"
path_append "$HOME/.yarn/bin"
path_append "$BUN_INSTALL/bin"
path_append "$HOME/.cargo/bin"

export PATH

# History
mkdir -p "${XDG_STATE_HOME:-$HOME/.local/state}/zsh" \
  || print -u2 "[zshrc] WARNING: could not create ${XDG_STATE_HOME:-$HOME/.local/state}/zsh; history will not be saved."
export HISTFILE="${XDG_STATE_HOME:-$HOME/.local/state}/zsh/history"
setopt inc_append_history
setopt share_history

export HISTSIZE=100000
export SAVEHIST=100000

####################################################################################################
# Starship
####################################################################################################
export STARSHIP_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/starship/starship.toml"
eval "$(starship init zsh)"

####################################################################################################
# *env init
####################################################################################################
eval "$(rbenv init -)"
eval "$(nodenv init -)"
eval "$(direnv hook zsh)"

export GOENV_ROOT="$HOME/.goenv"
eval "$(goenv init -)"

####################################################################################################
# Completion
# You need to run the following commands
# gh completion -s zsh > $XDG_DATA_HOME/zsh/completions/_gh
# kube completion zsh > $XDG_DATA_HOME/zsh/completions/_kube
####################################################################################################

COMPLETION_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/zsh/completions"
if [ -d "$COMPLETION_DIR" ]; then
  fpath=($COMPLETION_DIR $fpath)
fi

# bun completions
[ -s "$HOME/.bun/_bun" ] && source "$HOME/.bun/_bun"


####################################################################################################
# Completion
####################################################################################################
zmodload zsh/complist
autoload -U compinit
mkdir -p "${XDG_CACHE_HOME:-$HOME/.cache}/zsh" \
  || print -u2 "[zshrc] WARNING: could not create ${XDG_CACHE_HOME:-$HOME/.cache}/zsh; completion cache will not be written."
compinit -i -d "${XDG_CACHE_HOME:-$HOME/.cache}/zsh/zcompdump-$ZSH_VERSION"

####################################################################################################
# Menu selection
####################################################################################################
zstyle ':completion:*' menu select

# Vim like keybinds to select an item from the menu
bindkey -M menuselect 'h' vi-backward-char
bindkey -M menuselect 'j' vi-down-line-or-history
bindkey -M menuselect 'k' vi-up-line-or-history
bindkey -M menuselect 'l' vi-forward-char

####################################################################################################
# Sheldon
# Must be loaded after compinit (required by zsh-syntax-highlighting)
####################################################################################################
if command -v sheldon > /dev/null 2>&1; then
  eval "$(sheldon source)"
else
  echo '[zshrc] WARNING: sheldon not found. Run: ./up sheldon' >&2
fi

####################################################################################################
# Utility functions
####################################################################################################

# [P]rint [W]orking [B]ranch
function pwb() {
  CURRENT_BRANCH=$(git branch -a | grep -E '^\*' | cut -b 3-)
  if [ ${CURRENT_BRANCH} = "master" ]; then
    return 1
  fi
  if [ ${CURRENT_BRANCH} = "main" ]; then
    return 1
  fi
  echo ${CURRENT_BRANCH}
  return 0
}

# Setup tmux panes (3 panes)
function ide() {
  tmux split-window -v -l 30%
  tmux split-window -h -l 66%
  tmux split-window -h -l 50%
  tmux select-pane -t 0
}

# Setup tmux panes (4 panes)
function four-panes() {
  tmux split-window -h -l 50%
  tmux select-pane -t 0
  tmux split-window -v -l 50%
  tmux select-pane -t 2
  tmux split-window -v -l 50%
}

# Print 256 colors
function 256colors() {
  for i in {0..255} ; do
    printf "\x1b[48;5;%sm%3d\e[0m " "$i" "$i"
    if (( i == 15 )) || (( i > 15 )) && (( (i-15) % 6 == 0 )); then
      printf "\n";
    fi
  done
}

# Change directory by using ghq
function search_repo_and_change_directory() {
  local repo=$(ghq list -p | fzf)
  if [ -n "${repo}" ]; then
    BUFFER="cd ${repo}"
    zle accept-line
  fi
}
# Bind ctrl + f to search_repo_and_change_directory
zle -N search_repo_and_change_directory
bindkey '^F' search_repo_and_change_directory

# Switch git branch
function search_branch() {
  local branch=$(git branch | grep -v '*' | fzf)
  if [ -n "${branch}" ]; then
    BUFFER="git switch ${branch}"
    zle accept-line
  fi
}
# Bind ctrl + b to search_branch
zle -N search_branch
bindkey '^B' search_branch

# Load Angular CLI autocompletion.
# Temporarily disabled due to ESM/CommonJS compatibility issue
# command -v ng > /dev/null 2>&1 && source <(ng completion script)
