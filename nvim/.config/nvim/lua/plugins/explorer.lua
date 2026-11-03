return {
  -- Directories are opened by telescope-file-browser (see telescope.lua); neo-tree is the
  -- sidebar on `\`.
  {
    'nvim-neo-tree/neo-tree.nvim',
    version = '*',
    dependencies = {
      'nvim-lua/plenary.nvim',
      'nvim-tree/nvim-web-devicons',
      'MunifTanjim/nui.nvim',
    },
    opts = {
      filesystem = {
        -- telescope-file-browser opens directories (its hijack_netrw); two hijackers race and error
        hijack_netrw_behavior = 'disabled',
        filtered_items = {
          hide_dotfiles = false,
        },
      },
    },
    config = function(_, opts)
      require('neo-tree').setup(opts)
      vim.keymap.set('n', '\\', '<cmd>Neotree toggle<cr>', { desc = 'Toggle neo-tree' })
      vim.keymap.set('n', '<C-\\>', '<cmd>Neotree focus<cr>', { desc = 'Focus neo-tree' })
    end,
  },
}
