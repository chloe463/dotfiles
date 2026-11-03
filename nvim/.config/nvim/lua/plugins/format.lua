-- Formatter runner. prettierd is installed with Homebrew.
local prettier = { 'prettierd', 'prettier', stop_after_first = true }

return {
  'stevearc/conform.nvim',
  cmd = { 'ConformInfo' },
  keys = {
    {
      '<leader>pf',
      function() require('conform').format({ async = true, lsp_format = 'fallback' }) end,
      desc = '[P]retti[F]y',
    },
  },
  opts = {
    formatters_by_ft = {
      css = prettier,
      javascript = prettier,
      javascriptreact = prettier,
      typescript = prettier,
      typescriptreact = prettier,
      json = prettier,
    },
  },
}
