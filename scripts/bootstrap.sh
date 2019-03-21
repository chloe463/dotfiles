#!/bin/sh

set -eu
set -o pipefail

BASE_DIR=$HOME/dotfiles

echo "Making symlinks of prompt setup..."
echo

for f in prompt**
do
    CMD="ln -sf $HOME/dotfiles/$f $HOME/.zprezto/modules/prompt/functions/$f"
    echo $CMD
    $CMD
done

echo "Making symlinks of dot files..."
echo

for f in .**?
do
    [ "$f" == ".git" ] && continue
    [ "$f" == ".."   ] && continue
    [ "$f" == "."    ] && continue
    [ "$f" == ".DS_Store" ] && continue
    [ "$f" == ".zshrc" ] && continue
    echo "ln -sf $BASE_DIR/$f ~/$f"
    ln -sf $BASE_DIR/$f ~/$f
done

