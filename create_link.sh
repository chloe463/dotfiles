#!/bin/sh

for f in .**?
do
    [ "$f" == ".git" ] && continue
    [ "$f" == ".."   ] && continue
    [ "$f" == "."    ] && continue
    [ "$f" == ".DS_Store" ] && continue
    echo "ln -sf ~/dotfiles/$f ~/$f"
    ln -sf ~/dotfiles/$f ~/$f
done
