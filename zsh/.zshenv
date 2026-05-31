# XDG Base Directory
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
export XDG_STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"

# zsh config (XDG compliant). zsh reads this .zshenv from $HOME, then loads the
# remaining runcoms (.zprofile/.zshrc) from $ZDOTDIR.
export ZDOTDIR="$XDG_CONFIG_HOME/zsh"

# . "$HOME/.cargo/env"
