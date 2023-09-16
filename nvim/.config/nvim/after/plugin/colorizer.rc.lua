local status, colorizer = pcall(require, 'colorizer');
if (not status) then return end

colorizer.setup {
  '*',
  typescript = {
    rgb_fn = true,
  },
  javascript = {
    rgb_fn = true,
  },
  css = {
    rgb_fn = true,
  },
}
