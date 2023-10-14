local status, indent_blankline = pcall(require, 'ibl')
if (not status) then
  return
end

-- cf. https://github.com/lukas-reineke/indent-blankline.nvim
-- See `:help indent_blankline.txt`
indent_blankline.setup {
  indent = {
    char = '┊',
  },
  whitespace = {
    remove_blankline_trail = false,
  }
}

