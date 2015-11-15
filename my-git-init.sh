git config --global user.name TsuyoshiHara
git config --global user.email chloe463@gmail.com

git config --global color.diff   auto
git config --global color.status auto
git config --global color.branch auto
git config --global color.grep   auto

git config --global core.excludesfile $HOME/.gitignore
git config --global push.default current

git config --global alias.st   status
git config --global alias.co   checkout
git config --global alias.ci   commit\ -v
git config --global alias.di   diff
git config --global alias.br   branch
git config --global alias.puhs push
git config --global alias.psuh push
git config --global alias.pus  push
git config --global alias.puh  push
git config --global alias.pl   '!git pull && git submodule update --init'

echo .DS_Store >> $HOME/.gitignore
echo Thumbs.db >> $HOME/.gitignore
