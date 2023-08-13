local status, saga = pcall(require, 'lspsaga')
if (not status) then return end

saga.setup({
  ui = {
    border = 'rounded',
  },
  symbol_in_winbar = {
    enable = false,
  },
  lightbulb = {
    enable = false
  },
  outline = {
    layout = 'float'
  }
})

-- local diagnostic = require("lspsaga.diagnostic")
local opts = { noremap = true, silent = true }
vim.keymap.set('n', '<C-j>', '<Cmd>Lspsaga diagnostic_jump_next<CR>', opts)
vim.keymap.set('n', '<Leader>ld', '<Cmd>Lspsaga show_line_diagnostics<CR>', opts)
vim.keymap.set('n', '<Leader>pr', '<Cmd>Lspsaga finder<CR>', { desc = '[P]eek [R]eferences' })
vim.keymap.set('n', '<Leader>pd', '<Cmd>Lspsaga peek_definition<CR>', { desc = '[P]eek [D]efinition' })
vim.keymap.set('n', '<Leader>rn', '<Cmd>Lspsaga rename<CR>', { desc = '[R]e[N]ame' })

