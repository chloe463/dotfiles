local status, treesitter = pcall(require, 'nvim-treesitter')
if (not status) then return end

treesitter.install({
  'c', 'cpp', 'css', 'go', 'graphql', 'lua', 'python', 'ruby', 'rust', 'tsx', 'typescript', 'vimdoc', 'vim',
})

-- nvim-treesitter main branch removed configs module; highlighting is now delegated to Neovim core.
-- Use an augroup to prevent duplicate autocmds on :source or :Lazy reload.
local group = vim.api.nvim_create_augroup('user_treesitter', { clear = true })
vim.api.nvim_create_autocmd('FileType', {
  group = group,
  callback = function(args)
    local ok, err = pcall(vim.treesitter.start, args.buf)
    if not ok and not tostring(err):find('no parser') then
      vim.notify('[treesitter] ' .. tostring(err), vim.log.levels.WARN)
    end
  end,
})

-- textobjects: select
-- nvim-treesitter-textobjects main branch uses direct vim.keymap.set instead of configs.setup
local select = require('nvim-treesitter-textobjects.select')
vim.keymap.set({ 'x', 'o' }, 'aa', function() select.select_textobject('@parameter.outer', 'textobjects') end)
vim.keymap.set({ 'x', 'o' }, 'ia', function() select.select_textobject('@parameter.inner', 'textobjects') end)
vim.keymap.set({ 'x', 'o' }, 'af', function() select.select_textobject('@function.outer', 'textobjects') end)
vim.keymap.set({ 'x', 'o' }, 'if', function() select.select_textobject('@function.inner', 'textobjects') end)
vim.keymap.set({ 'x', 'o' }, 'ac', function() select.select_textobject('@class.outer', 'textobjects') end)
vim.keymap.set({ 'x', 'o' }, 'ic', function() select.select_textobject('@class.inner', 'textobjects') end)

-- textobjects: move
local move = require('nvim-treesitter-textobjects.move')
vim.keymap.set({ 'n', 'x', 'o' }, ']m', function() move.goto_next_start('@function.outer', 'textobjects') end)
vim.keymap.set({ 'n', 'x', 'o' }, ']]', function() move.goto_next_start('@class.outer', 'textobjects') end)
vim.keymap.set({ 'n', 'x', 'o' }, ']M', function() move.goto_next_end('@function.outer', 'textobjects') end)
vim.keymap.set({ 'n', 'x', 'o' }, '][', function() move.goto_next_end('@class.outer', 'textobjects') end)
vim.keymap.set({ 'n', 'x', 'o' }, '[m', function() move.goto_previous_start('@function.outer', 'textobjects') end)
vim.keymap.set({ 'n', 'x', 'o' }, '[[', function() move.goto_previous_start('@class.outer', 'textobjects') end)
vim.keymap.set({ 'n', 'x', 'o' }, '[M', function() move.goto_previous_end('@function.outer', 'textobjects') end)
vim.keymap.set({ 'n', 'x', 'o' }, '[]', function() move.goto_previous_end('@class.outer', 'textobjects') end)

-- textobjects: swap
local swap = require('nvim-treesitter-textobjects.swap')
vim.keymap.set('n', '<leader>a', function() swap.swap_next('@parameter.inner') end)
vim.keymap.set('n', '<leader>A', function() swap.swap_previous('@parameter.inner') end)
