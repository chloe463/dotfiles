local status, trouble = pcall(require, 'trouble')
if (not status) then return end

vim.keymap.set("n", "<leader>t", function() trouble.toggle({ mode = "diagnostics" }) end, { desc = '[T]rouble' })
vim.keymap.set("n", "<leader>wd", function() trouble.open({ mode = "diagnostics" }) end, { desc = '[W]orkspace [D]iagnostics' })
vim.keymap.set("n", "<leader>dd", function() trouble.open({ mode = "diagnostics", filter = { buf = 0 } }) end, { desc = '[D]ocument [D]iagnostics' })
vim.keymap.set("n", "gR", function() trouble.open({ mode = "lsp_references" }) end, { desc = 'LSP References (Trouble)' })
