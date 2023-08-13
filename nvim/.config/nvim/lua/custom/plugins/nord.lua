-- Nord
-- https://www.nordtheme.com/docs/ports/vim

return {
  'nordtheme/vim',
  lazy = false,
  priority = 1000,
  opts = {},
  config = function ()
    vim.cmd.colorscheme 'nord'
  end,
}

