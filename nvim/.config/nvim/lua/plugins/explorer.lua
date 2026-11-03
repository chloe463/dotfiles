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
    cmd = 'Neotree',
    keys = {
      { '\\', '<cmd>Neotree toggle<cr>', desc = 'Toggle neo-tree' },
      { '<C-\\>', '<cmd>Neotree focus<cr>', desc = 'Focus neo-tree' },
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
  },
}
