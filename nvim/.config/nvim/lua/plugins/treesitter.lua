return {
  {
    'nvim-treesitter/nvim-treesitter',
    branch = 'main',
    lazy = false,
    build = ':TSUpdate',
    dependencies = {
      { 'nvim-treesitter/nvim-treesitter-textobjects', branch = 'main' },
    },
    config = function()
      local treesitter = require('nvim-treesitter')

      -- markdown and markdown_inline are bundled with Neovim
      treesitter.install({
        'bash', 'c', 'cpp', 'css', 'go', 'graphql', 'html', 'javascript', 'json', 'lua', 'python', 'ruby', 'rust',
        'styled', 'tsx', 'typescript', 'vimdoc', 'vim', 'yaml',
      })

      -- nvim-treesitter main branch removed configs module; highlighting is now delegated to Neovim core.
      -- Use an augroup to prevent duplicate autocmds on :source or :Lazy reload.
      local group = vim.api.nvim_create_augroup('user_treesitter', { clear = true })
      vim.api.nvim_create_autocmd('FileType', {
        group = group,
        callback = function(args)
          local ok, err = pcall(vim.treesitter.start, args.buf)
          if not ok then
            local msg = tostring(err)
            if not msg:find('no parser') and not msg:find('could not be created') then
              vim.notify('[treesitter] ' .. msg, vim.log.levels.WARN)
            end
          end
        end,
      })

      -- textobjects: select
      -- nvim-treesitter-textobjects main branch uses direct vim.keymap.set instead of configs.setup
      local select = require('nvim-treesitter-textobjects.select')
      local move = require('nvim-treesitter-textobjects.move')
      local swap = require('nvim-treesitter-textobjects.swap')

      vim.keymap.set({ 'x', 'o' }, 'aa', function() select.select_textobject('@parameter.outer', 'textobjects') end)
      vim.keymap.set({ 'x', 'o' }, 'ia', function() select.select_textobject('@parameter.inner', 'textobjects') end)
      vim.keymap.set({ 'x', 'o' }, 'af', function() select.select_textobject('@function.outer', 'textobjects') end)
      vim.keymap.set({ 'x', 'o' }, 'if', function() select.select_textobject('@function.inner', 'textobjects') end)
      vim.keymap.set({ 'x', 'o' }, 'ac', function() select.select_textobject('@class.outer', 'textobjects') end)
      vim.keymap.set({ 'x', 'o' }, 'ic', function() select.select_textobject('@class.inner', 'textobjects') end)

      -- textobjects: move
      vim.keymap.set({ 'n', 'x', 'o' }, ']m', function() move.goto_next_start('@function.outer', 'textobjects') end)
      vim.keymap.set({ 'n', 'x', 'o' }, ']]', function() move.goto_next_start('@class.outer', 'textobjects') end)
      vim.keymap.set({ 'n', 'x', 'o' }, ']M', function() move.goto_next_end('@function.outer', 'textobjects') end)
      vim.keymap.set({ 'n', 'x', 'o' }, '][', function() move.goto_next_end('@class.outer', 'textobjects') end)
      vim.keymap.set({ 'n', 'x', 'o' }, '[m', function() move.goto_previous_start('@function.outer', 'textobjects') end)
      vim.keymap.set({ 'n', 'x', 'o' }, '[[', function() move.goto_previous_start('@class.outer', 'textobjects') end)
      vim.keymap.set({ 'n', 'x', 'o' }, '[M', function() move.goto_previous_end('@function.outer', 'textobjects') end)
      vim.keymap.set({ 'n', 'x', 'o' }, '[]', function() move.goto_previous_end('@class.outer', 'textobjects') end)

      -- textobjects: swap
      vim.keymap.set('n', '<leader>a', function() swap.swap_next('@parameter.inner') end)
      vim.keymap.set('n', '<leader>A', function() swap.swap_previous('@parameter.inner') end)
    end,
  },

  -- Show the enclosing function, class, ... at the top of the window
  { 'nvim-treesitter/nvim-treesitter-context', event = { 'BufReadPost', 'BufNewFile', 'BufWritePre' } },

  -- Auto close and rename HTML/JSX tags
  { 'windwp/nvim-ts-autotag', event = { 'BufReadPost', 'BufNewFile', 'BufWritePre' }, opts = {} },

  {
    'JoosepAlviste/nvim-ts-context-commentstring',
    config = function()
      -- Commenting uses the built-in `gc` (`:help commenting`), which reads 'commentstring'.
      -- Resolve it from the treesitter context under the cursor instead of the filetype, so
      -- that e.g. JSX in a .tsx file is commented with `{/* */}`.
      -- cf. https://github.com/JoosepAlviste/nvim-ts-context-commentstring/wiki/Integrations#native-commenting-in-neovim-010
      require('ts_context_commentstring').setup({ enable_autocmd = false })

      local get_option = vim.filetype.get_option
      ---@diagnostic disable-next-line: duplicate-set-field
      vim.filetype.get_option = function(filetype, option)
        return option == 'commentstring'
          and require('ts_context_commentstring.internal').calculate_commentstring()
          or get_option(filetype, option)
      end
    end,
  },
}
