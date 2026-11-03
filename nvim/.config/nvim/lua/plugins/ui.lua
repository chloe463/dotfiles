return {
  -- Colorscheme. https://github.com/gbprod/nord.nvim
  {
    'gbprod/nord.nvim',
    lazy = false,
    priority = 1000,
    config = function()
      require('nord').setup({})
      vim.cmd.colorscheme('nord')
    end,
  },

  {
    'nvim-lualine/lualine.nvim',
    opts = {
      options = {
        icons_enabled = true,
        theme = 'nord',
        section_separators = { left = '', right = '' },
        component_separators = { left = '', right = '' },
        disabled_filetypes = {}
      },
      sections = {
        lualine_a = { 'mode' },
        lualine_b = { 'branch' },
        lualine_c = {{
          'filename',
          file_status = true,
          path = 1,
        }},

        lualine_x = {
          {
            'diagnostics',
            sources = { "nvim_diagnostic" },
            symbols = { error = ' ', warn = ' ', info = ' ', hint = ' ' }
          },
          'encoding',
          'filetype'
        },
        lualine_y = { 'progress' },
        lualine_z = { 'location' },
      },
      inactive_sections = {
        lualine_a = {},
        lualine_b = {},
        lualine_c = {{
          'filename',
          file_status = true,
          path = 1,
        }},

        lualine_x = { 'location' },
        lualine_y = {},
        lualine_z = {},
      }
    },
  },

  {
    'akinsho/bufferline.nvim',
    version = '*',
    dependencies = 'nvim-tree/nvim-web-devicons',
    opts = {
      options = {
        mode = 'tabs',
        separator_style = 'thick',
        always_show_bufferline = true,
        show_buffer_close_icons = false,
        show_close_icon = false,
        color_icons = true,
        indicator = {
          style = 'underline',
        },
        diagnostics = 'nvim_lsp',
        --- @diagnostic disable-next-line: unused-local
        diagnostics_indicator = function(_count, _level, diagnostics_dict)
          local error_icon = ' '
          local warning_icon = ' '
          local error_count = diagnostics_dict.error
          local warning_count = diagnostics_dict.warning

          local message = ''
          if error_count and error_count > 0 then
            local error_message = ' ' .. error_icon .. error_count
            message = message .. error_message
          end
          if warning_count and warning_count > 0 then
            local warning_message = ' ' .. warning_icon .. warning_count
            message = message .. warning_message
          end
          return message
        end,
        tab_size = 24,
      },
    },
  },

  -- Indentation guides, even on blank lines. See `:help ibl.config`
  {
    'lukas-reineke/indent-blankline.nvim',
    main = 'ibl',
    opts = {
      indent = {
        char = '┊',
      },
      whitespace = {
        remove_blankline_trail = false,
      }
    },
  },

  -- Pending keybinds
  { 'folke/which-key.nvim', opts = {} },

  -- Highlight other uses of the word under the cursor
  {
    'RRethy/vim-illuminate',
    config = function()
      require('illuminate').configure({ delay = 250 })
    end,
  },

  -- Highlight color codes
  {
    'NvChad/nvim-colorizer.lua',
    opts = {
      filetypes = { '*' },
      options = {
        parsers = {
          css_fn = true,
        },
      },
    },
  },

  {
    'folke/todo-comments.nvim',
    dependencies = { 'nvim-lua/plenary.nvim' },
    opts = {},
  },

  -- Renders markdown in the plan viewer that ai-layout opens. Only enabled there,
  -- so that normal editing keeps showing the raw markdown.
  {
    'MeanderingProgrammer/render-markdown.nvim',
    dependencies = { 'nvim-treesitter/nvim-treesitter', 'nvim-tree/nvim-web-devicons' },
    cond = vim.env.AI_PLAN_VIEWER == '1',
    opts = {
        -- The viewer is read-only, so keep the cursor line rendered too.
        anti_conceal = { enabled = false },
    },
  },
}
