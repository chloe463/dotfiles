-- Set <space> as the leader key. See `:help mapleader`
-- Must happen before any keymaps or plugins are loaded (otherwise the wrong leader is used)
vim.g.mapleader = ' '
vim.g.maplocalleader = ' '

require('config.options')
require('config.keymaps')
require('config.autocmds')
require('config.lazy')

-- vim: ts=2 sts=2 sw=2 et
