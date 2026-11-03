import { expect, describe, it, beforeAll, afterAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

// Starts the Neovim config in this repository headless and inspects the state it
// leaves behind. It needs `nvim` and the plugins lazy.nvim has already installed,
// so it only runs locally: CI has neither, and the suite is skipped there.

const configHome = join(import.meta.dir, '../nvim/.config');
const dataHome = process.env.XDG_DATA_HOME ?? join(homedir(), '.local/share');
const hasNvim = spawnSync('nvim', ['--version'], { stdio: 'ignore' }).status === 0;
const hasPlugins = existsSync(join(dataHome, 'nvim/lazy/lazy.nvim'));

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'nvim-config-'));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

// Runs `body` (Lua that returns a value) after the config has loaded and returns
// that value decoded from JSON.
function inspect<T>(body: string): T {
  const script = join(root, 'inspect.lua');
  const out = join(root, 'out.json');
  writeFileSync(script, `local value = (function()\n${body}\nend)()\nvim.fn.writefile({ vim.json.encode(value) }, ${JSON.stringify(out)})\n`);
  writeFileSync(out, '');
  const result = spawnSync('nvim', ['--headless', '-i', 'NONE', '-c', `luafile ${script}`, '-c', 'qa!'], {
    encoding: 'utf8',
    env: { ...process.env, XDG_CONFIG_HOME: configHome, NVIM_APPNAME: 'nvim' },
    timeout: 60_000,
  });
  const json = readFileSync(out, 'utf8').trim();
  if (result.status !== 0 || json === '') {
    throw new Error(`nvim failed (status ${result.status}):\n${result.stdout}${result.stderr}`);
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
  const env = { ...process.env, XDG_CONFIG_HOME: configHome, NVIM_APPNAME: 'nvim' };
  const proc = Bun.spawn(['nvim', '--headless', '-n', '-i', 'NONE', '--listen', socket, file], {
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
    await server.waitFor('true', 10_000);
    await fn(server);
  } finally {
    proc.kill();
    await proc.exited;
  }
}

type Mapping = { mode: string; lhs: string; rhs: string };

describe.skipIf(!hasNvim || !hasPlugins)('nvim config', () => {
  it('starts without errors', () => {
    const state = inspect<{ errmsg: string; messages: string }>(`
      return { errmsg = vim.v.errmsg, messages = vim.fn.execute('messages') }
    `);
    expect(state.errmsg).toBe('');
    expect(state.messages.trim()).toBe('');
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
    const errors = inspect<Record<string, string[]>>(`
      local errors = {}
      local notify = vim.notify
      local result = {}
      vim.notify = function(msg, level)
        if level == vim.log.levels.ERROR then table.insert(errors, tostring(msg)) end
      end
      for _, lhs in ipairs({ ' t', ' wd', ' dd', 'gR' }) do
        errors = {}
        local map = vim.fn.maparg(lhs, 'n', false, true)
        if not map.callback then
          table.insert(errors, 'not mapped')
        else
          local ok, err = pcall(map.callback)
          if not ok then table.insert(errors, tostring(err)) end
          vim.wait(200)
        end
        pcall(function() require('trouble').close() end)
        result[lhs] = errors
      end
      vim.notify = notify
      return result
    `);
    expect(errors).toEqual({ ' t': [], ' wd': [], ' dd': [], gR: [] });
  });

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
  );

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

  it('shows the treesitter context', () => {
    expect(inspect<boolean>("return require('treesitter-context').enabled()")).toBe(true);
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

  describe('LSP', () => {
    type Attached = {
      clients: string[];
      maps: Record<string, boolean>;
      format: boolean;
      missingFields: boolean;
      snippetSupport: boolean;
    };
    let attached: Attached;

    beforeAll(() => {
      const file = join(root, 'attach.lua');
      writeFileSync(file, 'local x = 1\n');
      attached = inspect<Attached>(`
        vim.cmd.edit(${JSON.stringify(file)})
        vim.wait(20000, function() return #vim.lsp.get_clients({ bufnr = 0, name = 'lua_ls' }) > 0 end)
        local maps = {}
        for _, lhs in ipairs({ 'gd', 'gr', 'gI', ' ca', ' D', ' ds', ' ws', 'K', ' h', '<C-K>', ' rn', ' pr', ' pd' }) do
          maps[lhs] = vim.fn.maparg(lhs, 'n', false, true).buffer == 1
        end
        local client = vim.lsp.get_clients({ bufnr = 0, name = 'lua_ls' })[1]
        local disabled = vim.tbl_get(client and client.config.settings or {}, 'Lua', 'diagnostics', 'disable') or {}
        return {
          clients = vim.tbl_map(function(c) return c.name end, vim.lsp.get_clients({ bufnr = 0 })),
          maps = maps,
          format = vim.api.nvim_buf_get_commands(0, {}).Format ~= nil,
          missingFields = vim.tbl_contains(disabled, 'missing-fields'),
          snippetSupport = vim.tbl_get(client and client.config.capabilities or {},
            'textDocument', 'completion', 'completionItem', 'snippetSupport') == true,
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
      expect(attached.snippetSupport).toBe(true);
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
      const enabled = inspect<Record<string, boolean>>(`
        return { ruby_lsp = vim.lsp.is_enabled('ruby_lsp'), solargraph = vim.lsp.is_enabled('solargraph') }
      `);
      expect(enabled).toEqual({ ruby_lsp: true, solargraph: false });
    });
  });
});
