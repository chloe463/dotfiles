# Source Prezto.
if [[ -s "${ZDOTDIR:-$HOME}/.zprezto/init.zsh" ]]; then
  source "${ZDOTDIR:-$HOME}/.zprezto/init.zsh"
fi

# Credentials, such as GitHub token, must be written in the following file
[ -f ~/.credentials.zsh ] && source ~/.credentials.zsh

alias cat='bat'
alias g='git'
alias be='bundle exec'
alias ls='exa --group-directories-first --icons'
alias vim='nvim'

export PSQL_EDITOR='vim +"set syntax=sql" '
export EDITOR=/usr/bin/vim
export PATH=$PATH:'/Applications/Postgres.app/Contents/Versions/latest/bin'

eval "$(rbenv init -)"
eval "$(nodenv init -)"
eval "$(direnv hook zsh)"

eval "$(starship init zsh)"

export GOENV_ROOT="$HOME/.goenv"
export PATH="$HOME/bin:$GOENV_ROOT/bin:$HOME/go/1.19.0/bin:$PATH"
eval "$(goenv init -)"

[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

# For deno completion
# autoload -U compinit
# compinit

# COMPLETION_DIR=$HOME/.my_completions
# if [ -d $COMPLETION_DIR ]; then
#   fpath=($COMPLETION_DIR $fpath)
# fi
# You need to run the following commands
# gh completion -s zsh > $HOME/.my_completions/_gh

COMPLETION_DIR=$HOME/.my_completions
if [ -d $COMPLETION_DIR ]; then
  fpath=($COMPLETION_DIR $fpath)
fi

# For completion
autoload -U compinit
compinit -i

# History
setopt inc_append_history
setopt share_history

export HISTSIZE=100000
export SAVEHIST=100000

# Print Working Branch
function pwb() {
  CURRENT_BRANCH=$(git branch -a | grep -E '^\*' | cut -b 3-)
  if [ ${CURRENT_BRANCH} = "master" ]; then
    return 1
  fi
  echo ${CURRENT_BRANCH}
  return 0
}

# Setup tmux panes
function ide() {
  tmux split-window -v -p 30
  tmux split-window -h -p 66
  tmux split-window -h -p 50
  tmux select-pane -t 0
}

function four-panes() {
  tmux split-window -h -p 50
  tmux select-pane -t 0
  tmux split-window -v -p 50
  tmux select-pane -t 2
  tmux split-window -v -p 50
}

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
zle -N search_branch
bindkey '^G' search_branch

PATH=~/.console-ninja/.bin:$PATH