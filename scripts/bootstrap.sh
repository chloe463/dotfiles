#!/bin/sh

set -eu
set -o pipefail

BASE_DIR=$HOME/dotfiles

function make_prompt_set_symlinks()
{
    echo "Making symlinks of prompt setup..."
    echo

    for f in prompt**
    do
        CMD="ln -sf $HOME/dotfiles/prompts/$f $HOME/.zprezto/modules/prompt/functions/$f"
        echo $CMD
        $CMD
    done

    echo
    echo "🎉 Done!"
    echo
}

function make_dot_files_symlinks()
{
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

    echo
    echo "🎉 Done!"
    echo
}

function extend_zshrc()
{
    echo "Load .zshrc-extend from .zshrc"
    echo

    set +e
    RES=$(grep "source \$HOME/dotfiles/.zshrc-extend" $HOME/.zshrc)

    echo ${RES}
    if [ "${RES}" = "" ]; then
        echo "\"source \$HOME/dotfiles/.zshrc-extend\" >> $HOME/.zshrc"
        echo "source \$HOME/dotfiles/.zshrc-extend" >> $HOME/.zshrc
    fi
    echo
    echo "🎉 Done!"
    echo
    set -e
}

function main()
{
    case $1 in
        "prompt")
            make_prompt_set_symlinks
            ;;
        "dot")
            make_dot_files_symlinks
            ;;
        "extend-zshrc")
            extend_zshrc
            ;;
        *)
            make_prompt_set_symlinks
            make_dot_files_symlinks
            extend_zshrc
            ;;
    esac
}

main ${1:-""}

