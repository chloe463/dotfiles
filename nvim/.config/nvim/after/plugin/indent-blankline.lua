local status, indent_blankline = pcall(require, 'indent_blankline')
if (not status) then
  return
end

-- cf. https://github.com/lukas-reineke/indent-blankline.nvim
-- See `:help indent_blankline.txt`
indent_blankline.setup {
  char = '┊',
  show_trailing_blankline_indent = false,
}

