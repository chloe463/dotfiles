return {
  -- Also loaded by its commands, so that `nvim +Git` works before VeryLazy
  {
    'tpope/vim-fugitive',
    event = 'VeryLazy',
    cmd = { 'G', 'Git', 'Gdiffsplit', 'Gvdiffsplit', 'Ghdiffsplit', 'Gread', 'Gwrite', 'Gedit', 'Gclog', 'GBrowse' },
  },
  { 'tpope/vim-rhubarb', event = 'VeryLazy' },

  -- Git signs in the gutter, and utilities for managing changes
  {
    'lewis6991/gitsigns.nvim',
    event = { 'BufReadPost', 'BufNewFile', 'BufWritePre' },
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
    event = { 'BufReadPost', 'BufNewFile', 'BufWritePre' },
    keys = {
      { '<leader>gbo', '<cmd>GitBlameOpenCommitURL<cr>', desc = '[G]it [B]lame [O]penCommitURL' },
    },
  },
}
