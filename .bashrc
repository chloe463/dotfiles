# .bashrc

# Source global definitions
if [ -f /etc/bashrc ]; then
	. /etc/bashrc
fi

# User specific aliases and functions

if [ -f $HOME/.git-prompt.sh ] ; then
    source $HOME/.git-prompt.sh
fi

if [ -f $HOME/.git-completion.bash ] ; then
    source $HOME/.git-completion.bash
fi

PS1='[\u@\h \W\[\033[33m\]$(__git_ps1)\[\033[0m\]]\$ '

