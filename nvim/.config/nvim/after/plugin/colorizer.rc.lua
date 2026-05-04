local status, colorizer = pcall(require, 'colorizer');
if (not status) then return end

colorizer.setup({
  filetypes = { '*' },
  options = {
    parsers = {
      css_fn = true,
    },
  },
})
