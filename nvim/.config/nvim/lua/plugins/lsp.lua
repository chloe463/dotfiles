-- Language servers to install with mason and enable. Each value is merged into the
-- server's default config from nvim-lspconfig (see `:help vim.lsp.config()`).
local servers = {
  cssls = {},
  graphql = {},
  ts_ls = {},
  eslint = {},
  jsonls = {},
  lua_ls = {
    settings = {
      Lua = {
        workspace = { checkThirdParty = false },
        telemetry = { enable = false },
        -- Ignore lua_ls's noisy `missing-fields` warnings
        diagnostics = { disable = { 'missing-fields' } },
      },
    },
  },
  ruby_lsp = {},
}

-- Buffer-local keymaps for a buffer an LSP client has attached to
local function on_attach(bufnr)
  local function nmap(keys, func, desc)
    vim.keymap.set('n', keys, func, { buffer = bufnr, desc = 'LSP: ' .. desc })
  end

  local builtin = require('telescope.builtin')

  nmap('<leader>rn', vim.lsp.buf.rename, '[R]e[N]ame')
  nmap('<leader>ca', vim.lsp.buf.code_action, '[C]ode [A]ction')

  nmap('gd', vim.lsp.buf.definition, '[G]oto [D]efinition')
  nmap('gr', builtin.lsp_references, '[G]oto [R]eferences')
  nmap('gI', vim.lsp.buf.implementation, '[G]oto [I]mplementation')
  nmap('<leader>D', vim.lsp.buf.type_definition, 'Type [D]efinition')
  nmap('<leader>ds', builtin.lsp_document_symbols, '[D]ocument [S]ymbols')
  nmap('<leader>ws', builtin.lsp_dynamic_workspace_symbols, '[W]orkspace [S]ymbols')

  -- Peek the references and definitions in a telescope picker without jumping
  nmap('<leader>pr', builtin.lsp_references, '[P]eek [R]eferences')
  nmap('<leader>pd', function() builtin.lsp_definitions({ jump_type = 'never' }) end, '[P]eek [D]efinition')

  -- `K` is mapped to hover by Neovim (see `:help lsp-defaults`)
  nmap('<leader>h', vim.lsp.buf.hover, '[H]over Documentation')
  nmap('<C-k>', vim.lsp.buf.signature_help, 'Signature Documentation')

  -- Lesser used LSP functionality
  nmap('gD', vim.lsp.buf.declaration, '[G]oto [D]eclaration')
  nmap('<leader>wa', vim.lsp.buf.add_workspace_folder, '[W]orkspace [A]dd Folder')
  nmap('<leader>wr', vim.lsp.buf.remove_workspace_folder, '[W]orkspace [R]emove Folder')
  nmap('<leader>wl', function()
    print(vim.inspect(vim.lsp.buf.list_workspace_folders()))
  end, '[W]orkspace [L]ist Folders')

  vim.api.nvim_buf_create_user_command(bufnr, 'Format', function()
    vim.lsp.buf.format()
  end, { desc = 'Format current buffer with LSP' })
end

return {
  {
    'neovim/nvim-lspconfig',
    -- Starts the servers when the first file is opened
    event = { 'BufReadPre', 'BufNewFile' },
    dependencies = {
      'williamboman/mason.nvim',
      'williamboman/mason-lspconfig.nvim',
      'saghen/blink.cmp',
    },
    config = function()
      vim.api.nvim_create_autocmd('LspAttach', {
        group = vim.api.nvim_create_augroup('user_lsp_attach', { clear = true }),
        callback = function(args)
          on_attach(args.buf)
        end,
      })

      -- blink.cmp supports additional completion capabilities, so broadcast that to every server
      vim.lsp.config('*', {
        capabilities = require('blink.cmp').get_lsp_capabilities(),
      })
      for name, config in pairs(servers) do
        vim.lsp.config(name, config)
      end

      -- Install the servers above and enable only them, so that servers installed in mason
      -- for other reasons (e.g. solargraph) are not started.
      require('mason-lspconfig').setup({
        ensure_installed = vim.tbl_keys(servers),
        automatic_enable = vim.tbl_keys(servers),
      })
    end,
  },

  -- Installs the language servers. Loaded by nvim-lspconfig on opening a file, or by its
  -- commands before that (it has no plugin/ directory, so the commands come from setup())
  {
    'williamboman/mason.nvim',
    cmd = { 'Mason', 'MasonInstall', 'MasonUninstall', 'MasonUninstallAll', 'MasonUpdate', 'MasonLog' },
    opts = {},
  },

  -- LSP progress notifications
  { 'j-hui/fidget.nvim', event = 'LspAttach', opts = {} },

  -- Completion, annotations and signatures of the Neovim Lua API for lua_ls
  {
    'folke/lazydev.nvim',
    ft = 'lua',
    opts = {
      library = {
        -- Load the luv types when the `vim.uv` word is found
        { path = '${3rd}/luv/library', words = { 'vim%.uv' } },
      },
    },
  },

  -- Lists of diagnostics, references, ...
  {
    'folke/trouble.nvim',
    dependencies = { 'nvim-tree/nvim-web-devicons' },
    cmd = 'Trouble',
    keys = {
      { '<leader>t', function() require('trouble').toggle({ mode = 'diagnostics' }) end, desc = '[T]rouble' },
      { '<leader>wd', function() require('trouble').open({ mode = 'diagnostics' }) end, desc = '[W]orkspace [D]iagnostics' },
      {
        '<leader>dd',
        function() require('trouble').open({ mode = 'diagnostics', filter = { buf = 0 } }) end,
        desc = '[D]ocument [D]iagnostics',
      },
      { 'gR', function() require('trouble').open({ mode = 'lsp_references' }) end, desc = 'LSP References (Trouble)' },
    },
    opts = {},
  },
}
