""" Basic settings
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
set encoding=utf-8
set number
set ruler
set title
set showmatch
set autoindent
set expandtab
set tabstop=2
set shiftwidth=2
set smartindent
set ignorecase
set smartcase
set wrapscan
set backspace=indent,eol,start
set hlsearch

" Without this, webpack dev server doesnt work correctly
set backupcopy=yes

syntax on

""" Keymaps
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
inoremap <silent> jj <ESC>
inoremap <silent> kk <ESC>
inoremap <silent> jk <ESC>

nmap <Esc><Esc> :nohlsearch<CR><Esc>

""" plugins
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
if has('vim_starting')
    set rtp+=~/.vim/plugged/vim-plug
    if !isdirectory(expand('~/.vim/plugged/vim-plug'))
        echo 'install vim-plug...'
        call system('mkdir -p ~/.vim/plugged/vim-plug')
        call system('git clone https://github.com/junegunn/vim-plug.git ~/.vim/plugged/vim-plug/autoload')
    end
endif

call plug#begin('~/.vim/plugged')
    Plug 'junegunn/vim-plug',
                \ {'dir': '~/.vim/plugged/vim-plug/autoload'}
    Plug 'junegunn/seoul256.vim'
    Plug 'itchyny/lightline.vim'
    Plug 'tpope/vim-fugitive'
    Plug 'scrooloose/nerdtree'
    Plug 'nathanaelkane/vim-indent-guides'
    Plug 'airblade/vim-gitgutter'
    Plug 'junegunn/vim-easy-align'
    Plug 'leafgarland/typescript-vim'
    Plug 'w0ng/vim-hybrid'
    Plug 'editorconfig/editorconfig-vim'
    Plug 'mattn/emmet-vim'
    Plug 'alvan/vim-closetag'
    Plug 'ctrlpvim/ctrlp.vim'
    Plug '/usr/local/opt/fzf'
    Plug 'tpope/vim-surround'
call plug#end()

set laststatus=2

colo hybrid
set background=dark

let g:lightline = {
      \ 'colorscheme': 'wombat',
      \ 'active': {
      \   'left': [ [ 'mode', 'paste' ],
      \             [ 'fugitive', 'readonly', 'filename', 'modified' ] ]
      \ },
      \ 'component': {
      \   'readonly': '%{&filetype=="help"?"":&readonly?"🔒":""}',
      \   'modified': '%{&filetype=="help"?"":&modified?"+":&modifiable?"":"-"}',
      \   'fugitive': '%{exists("*FugitiveHead")?FugitiveHead():""}'
      \ },
      \ 'component_visible_condition': {
      \   'readonly': '(&filetype!="help"&& &readonly)',
      \   'modified': '(&filetype!="help"&&(&modified||!&modifiable))',
      \   'fugitive': '(exists("*FugitiveHead") && ""!=FugitiveHead())'
      \ },
      \ 'separator': { 'left': '', 'right': '' },
      \ 'subseparator': { 'left': '', 'right': '' }
      \}

""" Nerdtree
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

" keymap
nnoremap <silent><C-e> :NERDTreeToggle<CR>

" show hidden files
let NERDTreeShowHidden=1
let g:NERDTreeNodeDelimiter = "\u00a0"
let g:NERDTreeIgnore = ['\.swp']

let g:ctrlp_custom_ignore = {
  \ 'dir':  '\v[\/]\.?(git|hg|svn|node_modules|vendor|bundle|tmp)$',
  \ 'file': '\v\.(exe|so|dll)$',
  \ 'link': 'some_bad_symbolic_links',
  \ }

""" EasyAlign
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

" Start interactive EasyAlign in visual mode (e.g. vip<Enter>)
vmap <Enter> <Plug>(EasyAlign)
" Start interactive EasyAlign for a motion/text object (e.g. gaip)
nmap ga <Plug>(EasyAlign)

