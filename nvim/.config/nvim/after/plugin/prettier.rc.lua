local status, prettier = pcall(require, 'prettier')
if (not status) then return end

prettier.setup {
  -- You need to install 'prettierd' first.
  -- yarn global add prettierd
  bin = 'prettierd',
  filetypes = {
    'css',
    'javascript',
    'javascriptreact',
    'typescript',
    'typescriptreact',
    'json',
  }
}

vim.keymap.set(
  'n',
  '<leader>pf',
  function()
    vim.lsp.buf.format({ async = true })
  end,
  { desc = '[P]retti[F]y' }
)

