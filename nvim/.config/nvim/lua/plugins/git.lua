return {
  'tpope/vim-fugitive',
  'tpope/vim-rhubarb',

  -- Git signs in the gutter, and utilities for managing changes
  {
    'lewis6991/gitsigns.nvim',
    opts = {
      -- See `:help gitsigns.txt`
      signs = {
        add = { text = '+' },
        change = { text = '~' },
        delete = { text = '_' },
        topdelete = { text = '‾' },
        changedelete = { text = '~' },
      },
    },
  },

  {
    'f-person/git-blame.nvim',
    config = function()
      vim.keymap.set('n', '<leader>gbo', '<cmd>GitBlameOpenCommitURL<cr>', { desc = '[G]it [B]lame [O]penCommitURL' })
    end,
  },
}
