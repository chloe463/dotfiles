-- Highlight the yanked text. See `:help vim.hl.on_yank()`
vim.api.nvim_create_autocmd('TextYankPost', {
  group = vim.api.nvim_create_augroup('user_yank_highlight', { clear = true }),
  callback = function()
    vim.hl.on_yank()
  end,
})

-- cf. https://github.com/alacritty/alacritty/issues/5450#issuecomment-929797364
vim.api.nvim_create_autocmd('ExitPre', {
  group = vim.api.nvim_create_augroup('Exit', { clear = true }),
  command = 'set guicursor=a:ver90',
  desc = 'Set cursor back to beam when leaving Neovim.',
})

-- Reload buffers changed on disk ('autoread' only checks on some events)
-- cf. https://neovim.discourse.group/t/a-lua-based-auto-refresh-buffers-when-they-change-on-disk-function/2482/5
local autoread = vim.api.nvim_create_augroup('user_autoread', { clear = true })
vim.api.nvim_create_autocmd({ 'BufEnter', 'CursorHold', 'CursorHoldI', 'FocusGained' }, {
  group = autoread,
  command = "if mode() != 'c' | checktime | endif",
})
vim.api.nvim_create_autocmd('FileChangedShellPost', {
  group = autoread,
  command = 'echo "File changed on disk. Buffer reloaded."',
})
