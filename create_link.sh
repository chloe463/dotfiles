#!/bin/sh

BASE_DIR=$(dirname $(readlink -f $0))

for f in .**?
do
    [ "$f" == ".git" ] && continue
    [ "$f" == ".."   ] && continue
    [ "$f" == "."    ] && continue
    [ "$f" == ".DS_Store" ] && continue
    echo "ln -sf $BASE_DIR/$f ~/$f"
    ln -sf $BASE_DIR/$f ~/$f
done
