local status, _ = pcall(require, 'gitblame')
if (not status) then return end

vim.keymap.set('n', '<leader>gbo', '<cmd>GitBlameOpenCommitURL<cr>', { desc = '[G]it [B]lame [O]penCommitURL' })

