import { expect, describe, it, beforeAll, afterAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
        for _, lhs in ipairs({ 'gd', 'gr', 'gI', ' ca', ' D', ' ds', ' ws', 'K', ' h', '<C-K>' }) do
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
    });

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

    it('enables only one Ruby language server', () => {
      const enabled = inspect<Record<string, boolean>>(`
        return { ruby_lsp = vim.lsp.is_enabled('ruby_lsp'), solargraph = vim.lsp.is_enabled('solargraph') }
      `);
      expect(enabled).toEqual({ ruby_lsp: true, solargraph: false });
    });
  });
});
