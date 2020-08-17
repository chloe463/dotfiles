#!/usr/bin/env bash

# Install Homebrew
if type brew > /dev/null 2>&1; then
  echo 'Homebrew has already been installed.'
else
  echo 'Install Homebrew'
  /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
  brew update
fi

brew bundle

