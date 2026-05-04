local status, comment = pcall(require, 'Comment')
if (not status) then return end

local status2, ts_context_comment = pcall(require, 'ts_context_commentstring.integrations.comment_nvim')
if (not status2) then return end

local status3, ts_context = pcall(require, 'ts_context_commentstring')
if not status3 then
  vim.notify('[comment.rc.lua] ts_context_commentstring failed to load', vim.log.levels.ERROR)
  return
end

-- Disable the internal CursorHold autocmd; commentstring is resolved via comment_nvim pre_hook instead
ts_context.setup { enable_autocmd = false }

comment.setup {
  pre_hook = ts_context_comment.create_pre_hook(),
}
