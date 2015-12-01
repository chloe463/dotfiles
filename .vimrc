" 文字コード・改行コード
set encoding=utf-8

" 行番号を表示する
set number
" カーソルの行数、列数を表示する
set ruler
" 編集中のファイル名を表示
set title
" 括弧入力時の対応する括弧を表示
set showmatch
" コードの色分け
" colorscheme hybrid
syntax on
" インデントをスペース4つ分に設定
set tabstop=4
set autoindent
set expandtab
set shiftwidth=4

" オートインデント
set smartindent

" 大文字・小文字の区別なく検索
set ignorecase
" 検索文字列に大文字が含まれている場合は区別して検索
set smartcase
" 検索時に最後まで行ったら最初に戻る
set wrapscan

" バックスペースでインデントや改行を削除できるようにする
set backspace=indent,eol,start

" INSERTモード時に jj, kk or jk と押すと Esc
inoremap <silent> jj <ESC>
inoremap <silent> kk <ESC>
inoremap <silent> jk <ESC>

" カッコの自動入力
imap [ []<left>
imap ( ()<left>
imap { {<CR>}<left>
imap < <><left>

" 2回連続でESCを押したら検索のハイライトをやめる
nmap <Esc><Esc> :nohlsearch<CR><Esc>

