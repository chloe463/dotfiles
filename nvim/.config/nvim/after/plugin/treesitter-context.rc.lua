local status, treesitter_context = pcall(require, 'treesitter_context')
if (not status) then return end

treesitter_context.setup {
  enable = true,
}

