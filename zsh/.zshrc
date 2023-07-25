# Source Prezto.
if [[ -s "${ZDOTDIR:-$HOME}/.zprezto/init.zsh" ]]; then
  source "${ZDOTDIR:-$HOME}/.zprezto/init.zsh"
fi

alias g='git'
alias be='bundle exec'

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

# Print Working Branch
function pwb() {
  CURRENT_BRANCH=$(git branch -a | grep -E '^\*' | cut -b 3-)
  if [ ${CURRENT_BRANCH} = "master" ]; then
    return 1
  fi
  echo ${CURRENT_BRANCH}
  return 0
}

# Open new pull request
function new_pr() {
  REPO_URL=$(git remote get-url origin | sed -e 's/git@github.com:\(.*\)\.git/https:\/\/github.com\/\1/g')
  NEW_PR_URL="${REPO_URL}/pull/new/$(pwb)"
  echo ${NEW_PR_URL}
  open ${NEW_PR_URL}
}

# Search keyword with google
function ggrks() {
  BASE_URL="https://google.com/search"
  QUERY=`echo $@ | sed -e "s/ /+/g"`

  open "${BASE_URL}?q=${QUERY}"
}

# Setup tmux panes
function ide() {
  tmux split-window -v -p 30
  tmux split-window -h -p 50
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

alias newpr='new_pr'
alias openpr='new_pr'
alias ls='exa'
