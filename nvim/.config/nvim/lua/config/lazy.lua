-- Install lazy.nvim. See `:help lazy.nvim.txt`
local lazypath = vim.fn.stdpath('data') .. '/lazy/lazy.nvim'
if not vim.uv.fs_stat(lazypath) then
  vim.fn.system({
    'git',
    'clone',
    '--filter=blob:none',
    'https://github.com/folke/lazy.nvim.git',
    '--branch=stable',
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

-- Every file in lua/plugins/ returns a list of plugin specs
require('lazy').setup({ { import = 'plugins' } }, {
  -- No plugin needs luarocks; without this, :checkhealth warns that hererocks is not installed
  rocks = { enabled = false },
})
