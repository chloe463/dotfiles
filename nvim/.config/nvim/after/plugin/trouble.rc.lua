local status, trouble = pcall(require, 'trouble')
if (not status) then return end

vim.keymap.set("n", "<leader>t", function() require("trouble").open() end, { desc = '[T]rouble' })
vim.keymap.set("n", "<leader>wd", function() require("trouble").open("workspace_diagnostics") end, { desc = '[W]orkspace [D]iagnostics' })
vim.keymap.set("n", "<leader>dd", function() require("trouble").open("document_diagnostics") end, { desc = '[D]ocument [D]iagnostics' })
vim.keymap.set("n", "gR", function() require("trouble").open("lsp_references") end)

