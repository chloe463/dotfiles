return {
  -- Detect tabstop and shiftwidth automatically
  'tpope/vim-sleuth',

  { 'windwp/nvim-autopairs', event = 'InsertEnter', opts = {} },

  { 'kylechui/nvim-surround', version = '*', event = 'VeryLazy', opts = {} },
}
