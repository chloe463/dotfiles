local status, ts_context = pcall(require, 'ts_context_commentstring')
if not status then
  vim.notify('[commentstring.rc.lua] ts_context_commentstring failed to load', vim.log.levels.ERROR)
  return
end

-- Commenting uses the built-in `gc` (`:help commenting`), which reads 'commentstring'.
-- Resolve it from the treesitter context under the cursor instead of the filetype, so
-- that e.g. JSX in a .tsx file is commented with `{/* */}`.
-- cf. https://github.com/JoosepAlviste/nvim-ts-context-commentstring/wiki/Integrations#native-commenting-in-neovim-010
ts_context.setup { enable_autocmd = false }

local get_option = vim.filetype.get_option
---@diagnostic disable-next-line: duplicate-set-field
vim.filetype.get_option = function(filetype, option)
  return option == 'commentstring'
    and require('ts_context_commentstring.internal').calculate_commentstring()
    or get_option(filetype, option)
end
