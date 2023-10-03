-- [[ Basic Keymaps ]]

-- Enter normal mode by pressing double j or k
vim.keymap.set('i', 'jj', '<ESC>', { noremap = true, silent = true })
vim.keymap.set('i', 'kk', '<ESC>', { noremap = true, silent = true })

-- ...or j(k) and k(j)
vim.keymap.set('i', 'jk', '<ESC>', { noremap = true, silent = true })
vim.keymap.set('i', 'kj', '<ESC>', { noremap = true, silent = true })

-- Don't yank with x
vim.keymap.set('n', 'x', '"_x', { noremap = true, silent = true })

-- Hide highlight on double escape keys
vim.keymap.set('n', '<ESC><ESC>', vim.cmd.noh, { noremap = true, silent = true })

vim.keymap.set('n', 'n', 'nzz', { silent = true });
vim.keymap.set('n', 'N', 'Nzz', { silent = true });
vim.keymap.set('n', '*', '*Nzz', { silent = true });

-- Window spliting
vim.keymap.set('n', 'ss', ':split<CR><C-w>w')
vim.keymap.set('n', 'vs', ':vsplit<CR><C-w>w')

-- Reopen
-- vim.keymap.set('n', 'E', '<cmd>bufdo e!<cr>')

-- The following keymaps are from kickstart configuration
-- Keymaps for better default experience
-- See `:help vim.keymap.set()`
vim.keymap.set({ 'n', 'v' }, '<Space>', '<Nop>', { silent = true })

-- Remap for dealing with word wrap
vim.keymap.set('n', 'k', "v:count == 0 ? 'gk' : 'k'", { expr = true, silent = true })
vim.keymap.set('n', 'j', "v:count == 0 ? 'gj' : 'j'", { expr = true, silent = true })

-- Diagnostic keymaps
vim.keymap.set('n', '[d', vim.diagnostic.goto_prev, { desc = "Go to previous diagnostic message" })
vim.keymap.set('n', ']d', vim.diagnostic.goto_next, { desc = "Go to next diagnostic message" })
vim.keymap.set('n', '<leader>e', vim.diagnostic.open_float, { desc = "Open floating diagnostic message" })
vim.keymap.set('n', '<leader>q', vim.diagnostic.setloclist, { desc = "Open diagnostics list" })

-- https://github.com/ThePrimeagen/init.lua/blob/master/lua/theprimeagen/remap.lua
-- Grab single or multi line and move around
vim.keymap.set("v", "J", ":m '>+1<CR>gv=gv")
vim.keymap.set("v", "K", ":m '<-2<CR>gv=gv")

vim.keymap.set("v", "<M-Down>", ":m '>+1<CR>gv=gv")
vim.keymap.set("v", "<M-Up>", ":m '<-2<CR>gv=gv")

-- Better page scrolling
vim.keymap.set('n', '<C-d>', '<C-d>zz', { silent = true })
vim.keymap.set('n', '<C-u>', '<C-u>zz', { silent = true })
vim.keymap.set('n', '<C-f>', '<C-f>zz', { silent = true })
vim.keymap.set('n', '<C-b>', '<C-b>zz', { silent = true })

-- Store yanked string to clipboard
vim.keymap.set({"n", "v"}, "<leader>y", [["+y]])

-- greatest remap ever
vim.keymap.set("x", "<leader>p", [["_dP]])
