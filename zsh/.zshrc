####################################################################################################
# Prezto
####################################################################################################
if [[ -s "${ZDOTDIR:-$HOME}/.zprezto/init.zsh" ]]; then
  source "${ZDOTDIR:-$HOME}/.zprezto/init.zsh"
fi

####################################################################################################
# Other util settings
####################################################################################################
# Credentials, such as GitHub token, must be written in the following file
[ -f ~/.credentials.zsh ] && source ~/.credentials.zsh

# Configure fzf.
[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

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
export PATH=$PATH:'/Applications/Postgres.app/Contents/Versions/latest/bin'
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"

# For ffi
export LIBFFI_ROOT=$(brew --prefix libffi)
export PATH="$LIBFFI_ROOT/bin:$PATH"
export LDFLAGS="-L$LIBFFI_ROOT/lib $LDFLAGS"
export PKG_CONFIG_PATH="$PKG_CONFIG_PATH:$LIBFFI_ROOT/lib/pkgconfig"

# History
setopt inc_append_history
setopt share_history

export HISTSIZE=100000
export SAVEHIST=100000

####################################################################################################
# Starship
####################################################################################################
eval "$(starship init zsh)"

####################################################################################################
# *env init
####################################################################################################
eval "$(rbenv init -)"
eval "$(nodenv init -)"
eval "$(direnv hook zsh)"

export GOENV_ROOT="$HOME/.goenv"
export PATH="$HOME/bin:$HOME/scripts:$GOENV_ROOT/bin:$HOME/go/1.19.0/bin:$PATH"
eval "$(goenv init -)"

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Console ninja
# https://console-ninja.com/
export PATH=~/.console-ninja/.bin:$PATH

####################################################################################################
# Completion
# You need to run the following commands
# gh completion -s zsh > $HOME/.my_completions/_gh
# kube completion zsh > $HOME/.my_completions/_kube
####################################################################################################

COMPLETION_DIR=$HOME/.my_completions
if [ -d $COMPLETION_DIR ]; then
  fpath=($COMPLETION_DIR $fpath)
fi

# bun completions
[ -s "$HOME/.bun/_bun" ] && source "$HOME/.bun/_bun"

# For completion
autoload -U compinit
compinit -i

####################################################################################################
# Utility functions
####################################################################################################

# [P]rint [W]orking [B]ranch
function pwb() {
  CURRENT_BRANCH=$(git branch -a | grep -E '^\*' | cut -b 3-)
  if [ ${CURRENT_BRANCH} = "master" ]; then
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
