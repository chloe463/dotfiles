local status, comment = pcall(require, 'Comment')
if (not status) then return end

local status2, ts_context_comment = pcall(require, 'ts_context_commentstring.integrations.comment_nvim')
if (not status2) then return end

-- Disable the internal CursorHold autocmd; comment_nvim pre_hook handles this instead
local status3, ts_context = pcall(require, 'ts_context_commentstring')
if status3 then
  ts_context.setup { enable_autocmd = false }
end

comment.setup {
  pre_hook = ts_context_comment.create_pre_hook(),
}

