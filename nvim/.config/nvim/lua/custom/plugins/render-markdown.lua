-- Renders markdown in the plan viewer that ai-layout opens. Only enabled there,
-- so that normal editing keeps showing the raw markdown.
return {
  'MeanderingProgrammer/render-markdown.nvim',
  dependencies = { 'nvim-treesitter/nvim-treesitter', 'nvim-tree/nvim-web-devicons' },
  cond = vim.env.AI_PLAN_VIEWER == '1',
  opts = {
    -- The viewer is read-only, so keep the cursor line rendered too.
    anti_conceal = { enabled = false },
  },
}
