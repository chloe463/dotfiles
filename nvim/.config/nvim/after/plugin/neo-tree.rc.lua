local status, neotree = pcall(require, 'neo-tree')

if (not status) then return end

neotree.setup {
  filesystem = {
    filtered_items = {
      hide_dotfiles = false,
    },
  },
}

