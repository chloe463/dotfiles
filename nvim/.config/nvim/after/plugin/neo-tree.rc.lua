local status, neotree = pcall(require, 'neo-tree')

if (not status) then return end

neotree.setup {
  filesystem = {
    -- telescope-file-browser opens directories (its hijack_netrw); two hijackers race and error
    hijack_netrw_behavior = 'disabled',
    filtered_items = {
      hide_dotfiles = false,
    },
  },
}

