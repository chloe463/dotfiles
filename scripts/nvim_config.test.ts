import { expect, describe, it, beforeAll, afterAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

// Starts the Neovim config in this repository headless and inspects the state it
// leaves behind. It needs `nvim` and every plugin in lazy-lock.json installed (run
// `:Lazy restore` first), so it only runs locally: CI has neither, and the suite is
// skipped there. The plugins have to be installed beforehand because lazy.nvim would
// otherwise install the missing ones and rewrite lazy-lock.json in this repository.

const configHome = join(import.meta.dir, '../nvim/.config');
const lockfile = join(configHome, 'nvim/lazy-lock.json');
const dataHome = process.env.XDG_DATA_HOME ?? join(homedir(), '.local/share');
const hasNvim = spawnSync('nvim', ['--version'], { stdio: 'ignore' }).status === 0;
const hasPlugins = Object.keys(JSON.parse(readFileSync(lockfile, 'utf8'))).every((name) =>
  existsSync(join(dataHome, 'nvim/lazy', name)),
);
// XDG_CONFIG_HOME points at this repository, so tell git where the user's config is
const gitConfig = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'git/config');

let root: string;
let lock: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'nvim-config-'));
  mkdirSync(join(root, 'state'));
  mkdirSync(join(root, 'cache'));
  lock = readFileSync(lockfile, 'utf8');
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  if (readFileSync(lockfile, 'utf8') !== lock) {
    throw new Error('lazy-lock.json was changed while running the tests; run `:Lazy restore` and retry');
  }
});

// Uses the config in this repository and the installed plugins, but keeps the logs and
// caches the run writes out of the user's state and cache directories.
function nvimEnv() {
  return {
    ...process.env,
    XDG_CONFIG_HOME: configHome,
    XDG_STATE_HOME: join(root, 'state'),
    XDG_CACHE_HOME: join(root, 'cache'),
    NVIM_APPNAME: 'nvim',
    ...(existsSync(gitConfig) ? { GIT_CONFIG_GLOBAL: gitConfig } : {}),
  };
}

// Headless Neovim has no UI, so UIEnter never fires and lazy.nvim never loads the VeryLazy
// plugins. Fire it after VimEnter like a UI attaching would.
const uiEnter = 'autocmd VimEnter * ++once ++nested doautocmd UIEnter';

// Runs `body` (Lua that returns a value) after the config has loaded and returns
// that value decoded from JSON. It runs once lazy.nvim has loaded the VeryLazy plugins,
// which happens after VimEnter, so after any `-c` command.
function inspect<T>(body: string): T {
  const script = join(root, 'inspect.lua');
  const out = join(root, 'out.json');
  writeFileSync(
    script,
    `local ok, value = pcall(function()\n${body}\nend)\n` +
      `vim.fn.writefile({ ok and vim.json.encode(value) or ('ERROR: ' .. tostring(value)) }, ${JSON.stringify(out)})\n`,
  );
  writeFileSync(out, '');
  const run = `autocmd User VeryLazy ++once ++nested lua vim.schedule(function() pcall(vim.cmd.luafile, ${JSON.stringify(script)}); vim.cmd('qa!') end)`;
  const result = spawnSync('nvim', ['--headless', '-n', '-i', 'NONE', '--cmd', uiEnter, '--cmd', run], {
    encoding: 'utf8',
    env: nvimEnv(),
    timeout: 60_000,
  });
  const json = readFileSync(out, 'utf8').trim();
  if (result.status !== 0 || json === '' || json.startsWith('ERROR: ')) {
    throw new Error(`nvim failed (status ${result.status}): ${json}\n${result.stdout}${result.stderr}`);
  }
  return JSON.parse(json) as T;
}

// Starts the config with `--listen` and drives it from outside like a user typing,
// for behaviour that needs the event loop to run between keys (e.g. completion menus).
type Server = {
  send(keys: string): void;
  lua<T>(expr: string): T;
  waitFor(expr: string, timeout?: number): Promise<boolean>;
};

async function withServer(file: string, fn: (nvim: Server) => Promise<void>) {
  const socket = join(root, `nvim-${process.hrtime.bigint()}.sock`);
  const env = nvimEnv();
  const proc = Bun.spawn(['nvim', '--headless', '-n', '-i', 'NONE', '--cmd', uiEnter, '--listen', socket, file], {
    env,
    stdout: 'ignore',
    stderr: 'ignore',
  });
  const remote = (...args: string[]) =>
    spawnSync('nvim', ['--server', socket, ...args], { encoding: 'utf8', env, timeout: 10_000 });
  const lua = <T>(expr: string): T => {
    const code = `vim.json.encode((function() return ${expr} end)())`.replaceAll("'", "''");
    const out = remote('--remote-expr', `luaeval('${code}')`);
    return JSON.parse(out.stdout.trim()) as T;
  };
  const server: Server = {
    send: (keys) => {
      remote('--remote-send', keys);
    },
    lua,
    waitFor: async (expr, timeout = 30_000) => {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        try {
          if (lua<boolean>(expr)) return true;
        } catch {
          // The server is not listening yet
        }
        await Bun.sleep(200);
      }
      return false;
    },
  };
  try {
    if (!(await server.waitFor('true', 10_000))) throw new Error('nvim did not start listening');
    await fn(server);
  } finally {
    proc.kill();
    await proc.exited;
  }
}

type Mapping = { mode: string; lhs: string; rhs: string };

// A static check of the files: it needs neither nvim nor the plugins, so it runs in CI
describe('nvim config files', () => {
  it('does not use deprecated Neovim APIs', () => {
    const files = new Bun.Glob('**/*.lua').scanSync({ cwd: join(configHome, 'nvim'), absolute: true });
    const hits: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/vim\.loop\b|vim\.highlight\b|vim\.diagnostic\.goto_(prev|next)/.test(line)) hits.push(`${file}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });
});

describe.skipIf(!hasNvim || !hasPlugins)('nvim config', () => {
  it('loads the plugins for files, keys and commands lazily', () => {
    const loaded = inspect<Record<string, boolean>>(`
      local result = {}
      for _, name in ipairs({ 'nvim-lspconfig', 'blink.cmp', 'gitsigns.nvim', 'neo-tree.nvim', 'trouble.nvim', 'conform.nvim' }) do
        result[name] = require('lazy.core.config').plugins[name]._.loaded ~= nil
      end
      return result
    `);
    expect(loaded).toEqual(Object.fromEntries(Object.keys(loaded).map((k) => [k, false])));
  });

  it('starts without errors', () => {
    const state = inspect<{ errmsg: string; messages: string }>(`
      return { errmsg = vim.v.errmsg, messages = vim.fn.execute('messages') }
    `);
    expect(state.errmsg).toBe('');
    expect(state.messages.trim()).toBe('');
  });

  it('passes :checkhealth lazy without errors or warnings', () => {
    const problems = inspect<string[]>(`
      vim.cmd('checkhealth lazy')
      return vim.tbl_filter(function(line)
        return line:find('ERROR') ~= nil or line:find('WARNING') ~= nil
      end, vim.api.nvim_buf_get_lines(0, 0, -1, false))
    `);
    expect(problems).toEqual([]);
  });

  it('uses <Space> as the leader', () => {
    expect(inspect<string>('return vim.g.mapleader')).toBe(' ');
    expect(inspect<string>('return vim.g.maplocalleader')).toBe(' ');
  });

  it('maps the <leader> keymaps of keymaps.lua under <Space>, not the default backslash', () => {
    const maps = inspect<Mapping[]>(`
      local function get(mode, lhs)
        local m = vim.fn.maparg(lhs, mode, false, true)
        return { mode = mode, lhs = lhs, rhs = m.rhs or (m.callback and 'callback') or '' }
      end
      local result = {}
      for _, leader in ipairs({ ' ', '\\\\' }) do
        table.insert(result, get('n', leader .. 'y'))
        table.insert(result, get('n', leader .. 'e'))
        table.insert(result, get('n', leader .. 'q'))
        table.insert(result, get('x', leader .. 'p'))
      end
      return result
    `);
    const under = (leader: string) => maps.filter((m) => m.lhs.startsWith(leader));

    for (const m of under(' ')) {
      expect({ ...m, mapped: m.rhs !== '' }).toEqual({ ...m, mapped: true });
    }
    for (const m of under('\\')) {
      expect({ ...m, mapped: m.rhs !== '' }).toEqual({ ...m, mapped: false });
    }
  });

  it('opens trouble from its keymaps without errors', () => {
    const file = join(root, 'trouble.lua');
    // Two references besides the declaration: trouble jumps instead of opening for a single one
    writeFileSync(file, 'local foo = 1\nprint(foo)\nprint(foo)\n');
    const result = inspect<Record<string, { opened: boolean; errmsg: string }>>(`
      vim.cmd.edit(${JSON.stringify(file)})
      vim.wait(20000, function() return #vim.lsp.get_clients({ bufnr = 0, name = 'lua_ls' }) > 0 end)
      -- Give the diagnostics modes something to list
      vim.diagnostic.set(vim.api.nvim_create_namespace('test'), 0, {
        { lnum = 0, col = 0, message = 'test', severity = vim.diagnostic.severity.ERROR },
      })
      -- Wait until lua_ls answers references, which gR lists
      vim.api.nvim_win_set_cursor(0, { 1, 6 })
      vim.wait(30000, function()
        local params = vim.lsp.util.make_position_params(0, 'utf-16')
        params.context = { includeDeclaration = true }
        for _, res in pairs(vim.lsp.buf_request_sync(0, 'textDocument/references', params, 3000) or {}) do
          if res.result and #res.result > 0 then return true end
        end
        return false
      end, 1000)

      local function trouble_wins()
        return vim.tbl_filter(function(win)
          return vim.bo[vim.api.nvim_win_get_buf(win)].filetype == 'trouble'
        end, vim.api.nvim_list_wins())
      end
      local result = {}
      for _, lhs in ipairs({ ' t', ' wd', ' dd', 'gR' }) do
        vim.v.errmsg = ''
        -- Type the keys: lazy.nvim's keys handler loads the plugin and replays them
        vim.api.nvim_feedkeys(lhs, 'mx', false)
        local opened = vim.wait(5000, function() return #trouble_wins() > 0 end)
        result[lhs] = { opened = opened, errmsg = vim.v.errmsg }
        local trouble = require('trouble')
        while trouble.is_open() do trouble.close() end
        vim.api.nvim_win_set_cursor(0, { 1, 6 })
      end
      return result
    `);
    const ok = { opened: true, errmsg: '' };
    expect(result).toEqual({ ' t': ok, ' wd': ok, ' dd': ok, gR: ok });
  }, 120_000);

  it.skipIf(spawnSync('prettierd', ['--version'], { stdio: 'ignore' }).status !== 0)(
    'formats TypeScript with prettierd on <leader>pf',
    () => {
      const file = join(root, 'format.ts');
      writeFileSync(file, 'const  a={b:1}\n');
      const lines = inspect<string[]>(`
        vim.cmd.edit(${JSON.stringify(file)})
        local before = vim.api.nvim_buf_get_lines(0, 0, -1, false)
        -- Type the keys: lazy.nvim's keys handler loads the plugin and replays them
        vim.api.nvim_feedkeys(' pf', 'mx', false)
        vim.wait(10000, function() return not vim.deep_equal(vim.api.nvim_buf_get_lines(0, 0, -1, false), before) end)
        return vim.api.nvim_buf_get_lines(0, 0, -1, false)
      `);
      expect(lines).toEqual(['const a = { b: 1 };']);
    },
    60_000,
  );

  it('uses the current fidget.nvim instead of the legacy tag', () => {
    expect(inspect<boolean>("return type(require('fidget').notify) == 'function'")).toBe(true);
  });

  it('comments with the built-in gc, using the commentstring of the treesitter context', () => {
    const file = join(root, 'comment.tsx');
    writeFileSync(file, 'const a = (\n  <div>\n    <span />\n  </div>\n);\nconst b = 1;\n');
    const state = inspect<{ jsx: string; ts: string; commentNvim: boolean }>(`
      vim.cmd.edit(${JSON.stringify(file)})
      -- Headless Neovim never redraws, so the highlighter has not parsed the buffer yet
      vim.treesitter.get_parser(0):parse()
      vim.api.nvim_win_set_cursor(0, { 3, 0 })
      vim.api.nvim_feedkeys('gcc', 'mx', false)
      vim.api.nvim_win_set_cursor(0, { 6, 0 })
      vim.api.nvim_feedkeys('gcc', 'mx', false)
      return {
        jsx = vim.api.nvim_buf_get_lines(0, 2, 3, false)[1],
        ts = vim.api.nvim_buf_get_lines(0, 5, 6, false)[1],
        commentNvim = package.loaded['Comment'] ~= nil,
      }
    `);
    expect(state).toEqual({ jsx: '    {/* <span /> */}', ts: '// const b = 1;', commentNvim: false });
  });

  it('highlights common filetypes with treesitter', () => {
    const files = ['a.js', 'a.json', 'a.yaml', 'a.sh', 'a.html', 'a.ts', 'a.tsx', 'a.lua', 'a.rb'].map((name) => {
      const file = join(root, name);
      writeFileSync(file, '\n');
      return file;
    });
    const highlighted = inspect<Record<string, boolean>>(`
      local result = {}
      for _, file in ipairs(vim.json.decode(${JSON.stringify(JSON.stringify(files))})) do
        vim.cmd.edit(file)
        result[vim.fn.fnamemodify(file, ':t')] = vim.treesitter.highlighter.active[vim.api.nvim_get_current_buf()] ~= nil
      end
      return result
    `);
    expect(highlighted).toEqual(Object.fromEntries(Object.keys(highlighted).map((k) => [k, true])));
  });

  it('includes hidden files in telescope find_files by default', () => {
    expect(inspect<boolean>("return require('telescope.config').pickers.find_files.hidden")).toBe(true);
  });

  it('uses the built-in LSP UI with rounded borders instead of lspsaga', () => {
    const state = inspect<{ winborder: string; lspsaga: boolean; maps: Record<string, string> }>(`
      local function rhs(lhs)
        local m = vim.fn.maparg(lhs, 'n', false, true)
        return m.rhs or (m.callback and 'callback') or ''
      end
      return {
        winborder = vim.o.winborder,
        lspsaga = vim.fn.exists(':Lspsaga') == 2,
        maps = { ['<C-J>'] = rhs('<C-J>'), [' ld'] = rhs(' ld') },
      }
    `);
    expect(state).toEqual({ winborder: 'rounded', lspsaga: false, maps: { '<C-J>': 'callback', ' ld': 'callback' } });
  });

  it('uses the Lua port of the nord colorscheme', () => {
    const state = inspect<{ colors: string; lua: boolean }>(`
      return { colors = vim.g.colors_name, lua = package.loaded['nord'] ~= nil }
    `);
    expect(state).toEqual({ colors: 'nord', lua: true });
  });

  it('opens directories with telescope-file-browser, not neo-tree', () => {
    const dir = join(root, 'dir');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'x.txt'), '');
    const state = inspect<{ filetypes: string[]; errmsg: string }>(`
      -- neo-tree is loaded lazily; load it like after using \\, so that its netrw hijacking
      -- would race telescope-file-browser if it were enabled
      require('lazy').load({ plugins = { 'neo-tree.nvim' } })
      vim.v.errmsg = ''
      vim.cmd.edit(${JSON.stringify(dir)})
      -- The race fails in a scheduled callback, which only shows up in v:errmsg
      vim.wait(2000)
      local filetypes = {}
      for _, win in ipairs(vim.api.nvim_list_wins()) do
        table.insert(filetypes, vim.bo[vim.api.nvim_win_get_buf(win)].filetype)
      end
      return { filetypes = filetypes, errmsg = vim.v.errmsg }
    `);
    expect(state.errmsg).toBe('');
    expect(state.filetypes).toContain('TelescopePrompt');
    expect(state.filetypes).not.toContain('neo-tree');
  }, 60_000);

  describe('LSP', () => {
    type Attached = {
      clients: string[];
      maps: Record<string, boolean>;
      format: boolean;
      missingFields: boolean;
      resolveDetail: boolean;
    };
    let attached: Attached;

    beforeAll(() => {
      const file = join(root, 'attach.lua');
      writeFileSync(file, 'local x = 1\n');
      attached = inspect<Attached>(`
        vim.cmd.edit(${JSON.stringify(file)})
        vim.wait(20000, function() return #vim.lsp.get_clients({ bufnr = 0, name = 'lua_ls' }) > 0 end)
        local maps = {}
        for _, lhs in ipairs({ 'gd', 'gr', 'gI', ' ca', ' D', ' ds', ' ws', ' h', '<C-K>', ' rn', ' pr', ' pd' }) do
          maps[lhs] = vim.fn.maparg(lhs, 'n', false, true).buffer == 1
        end
        local client = vim.lsp.get_clients({ bufnr = 0, name = 'lua_ls' })[1]
        local disabled = vim.tbl_get(client and client.config.settings or {}, 'Lua', 'diagnostics', 'disable') or {}
        return {
          clients = vim.tbl_map(function(c) return c.name end, vim.lsp.get_clients({ bufnr = 0 })),
          maps = maps,
          format = vim.api.nvim_buf_get_commands(0, {}).Format ~= nil,
          missingFields = vim.tbl_contains(disabled, 'missing-fields'),
          -- Neovim's own capabilities resolve documentation, command and additionalTextEdits;
          -- blink.cmp adds detail
          resolveDetail = vim.tbl_contains(vim.tbl_get(client and client.config.capabilities or {},
            'textDocument', 'completion', 'completionItem', 'resolveSupport', 'properties') or {}, 'detail'),
        }
      `);
    }, 60_000);

    it('attaches lua_ls to Lua files', () => {
      expect(attached.clients).toContain('lua_ls');
    });

    it('sets the buffer-local LSP keymaps and :Format on attach', () => {
      expect(attached.maps).toEqual(Object.fromEntries(Object.keys(attached.maps).map((k) => [k, true])));
      expect(attached.format).toBe(true);
    });

    it('passes the configured settings and the completion capabilities to the server', () => {
      expect(attached.missingFields).toBe(true);
      expect(attached.resolveDetail).toBe(true);
    });

    it('resolves the Neovim Lua API in a Lua project (lazydev)', () => {
      const project = join(root, 'lua-project');
      mkdirSync(project, { recursive: true });
      writeFileSync(join(project, 'stylua.toml'), ''); // a root marker of lua_ls
      const file = join(project, 'init.lua');
      writeFileSync(file, 'local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)\n');
      const uri = inspect<string>(`
        vim.cmd.edit(${JSON.stringify(file)})
        vim.wait(20000, function() return #vim.lsp.get_clients({ bufnr = 0, name = 'lua_ls' }) > 0 end)
        local uri = ''
        -- lazydev hands the library to lua_ls after it has started, so retry until it resolves
        vim.wait(30000, function()
          local params = { textDocument = vim.lsp.util.make_text_document_params(0), position = { line = 0, character = 24 } }
          for _, res in pairs(vim.lsp.buf_request_sync(0, 'textDocument/definition', params, 3000) or {}) do
            if res.result and res.result[1] then
              uri = res.result[1].targetUri or res.result[1].uri
              return true
            end
          end
          return false
        end, 1000)
        return uri
      `);
      expect(uri).toContain('/lua/vim/_meta/api');
    }, 120_000);

    it('completes with blink.cmp and accepts the first item on <CR>', async () => {
      const file = join(root, 'complete.lua');
      writeFileSync(file, '');
      await withServer(file, async (nvim) => {
        await nvim.waitFor(`#vim.lsp.get_clients({ bufnr = 0, name = 'lua_ls' }) > 0`);
        // lua_ls returns no items until it has loaded the workspace, so type again until the menu shows
        let visible = false;
        for (let i = 0; i < 10 && !visible; i++) {
          nvim.send('<Esc>Slocal t = vim.api.nvim_buf_get_li');
          visible = await nvim.waitFor(`require('blink.cmp').is_menu_visible()`, 3000);
        }
        expect(visible).toBe(true);
        nvim.send('<CR>');
        await nvim.waitFor(`vim.api.nvim_get_current_line() ~= 'local t = vim.api.nvim_buf_get_li'`, 5000);
        expect(nvim.lua<string[]>(`vim.api.nvim_buf_get_lines(0, 0, -1, false)`)).toEqual(['local t = vim.api.nvim_buf_get_lines']);
        expect(nvim.lua<boolean>(`package.loaded['cmp'] ~= nil`)).toBe(false);
      });
    }, 120_000);

    it('enables only one Ruby language server', () => {
      const file = join(root, 'a.rb');
      writeFileSync(file, '');
      const enabled = inspect<Record<string, boolean>>(`
        -- The servers are set up when the first file is opened
        vim.cmd.edit(${JSON.stringify(file)})
        return { ruby_lsp = vim.lsp.is_enabled('ruby_lsp'), solargraph = vim.lsp.is_enabled('solargraph') }
      `);
      expect(enabled).toEqual({ ruby_lsp: true, solargraph: false });
    });
  });
});
