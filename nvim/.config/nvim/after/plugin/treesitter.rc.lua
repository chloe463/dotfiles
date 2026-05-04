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
