local status, comment = pcall(require, 'Comment')
if (not status) then return end

local status2, ts_context_comment = pcall(require, 'ts_context_commentstring.integrations.comment_nvim')
if (not status2) then return end

comment.setup {
  pre_hook = ts_context_comment.create_pre_hook(),
}

