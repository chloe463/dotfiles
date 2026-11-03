-- Autocompletion. Keeps the keymaps used with nvim-cmp before.
return {
  'saghen/blink.cmp',
  -- Use a release tag to download the prebuilt fuzzy matcher
  version = '1.*',
  event = { 'InsertEnter', 'CmdlineEnter' },
  opts = {
    keymap = {
      preset = 'none',
      ['<C-Space>'] = { 'show', 'show_documentation', 'hide_documentation' },
      ['<C-e>'] = { 'hide', 'fallback' },
      -- Accept the selected item, or the first one when none is selected
      ['<CR>'] = { 'select_and_accept', 'fallback' },
      ['<C-y>'] = { 'select_and_accept', 'fallback' },
      ['<Tab>'] = { 'select_next', 'snippet_forward', 'fallback' },
      ['<S-Tab>'] = { 'select_prev', 'snippet_backward', 'fallback' },
      ['<C-n>'] = { 'select_next', 'fallback' },
      ['<C-p>'] = { 'select_prev', 'fallback' },
      ['<C-d>'] = { 'scroll_documentation_up', 'fallback' },
      ['<C-f>'] = { 'scroll_documentation_down', 'fallback' },
    },
    completion = {
      -- Nothing is selected until <Tab>, and the selected item is inserted right away
      list = { selection = { preselect = false, auto_insert = true } },
      -- Insert only the name like nvim-cmp did, without adding `()` for functions
      accept = { auto_brackets = { enabled = false } },
      menu = { border = 'rounded' },
      documentation = { auto_show = true, window = { border = 'rounded' } },
    },
    sources = {
      default = { 'lsp', 'path', 'snippets' },
    },
    cmdline = {
      completion = { menu = { auto_show = true } },
    },
  },
}
