local status, bufferline = pcall(require, 'bufferline')
if (not status) then return end

bufferline.setup({
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
})

