local status, treesitter = pcall(require, 'nvim-treesitter')
if (not status) then return end

treesitter.install({
  'c', 'cpp', 'css', 'go', 'graphql', 'lua', 'python', 'ruby', 'rust', 'tsx', 'typescript', 'vimdoc', 'vim',
})

-- Neovim 0.12: use built-in treesitter highlighting instead of nvim-treesitter's
vim.api.nvim_create_autocmd('FileType', {
  callback = function(args)
    pcall(vim.treesitter.start, args.buf)
  end,
})
