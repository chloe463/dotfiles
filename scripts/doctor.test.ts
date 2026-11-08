import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkBrew, checkDefault, checkStow, checkVscodeExtensions, stowTargets } from './doctor';
import type { RunResult, Runner } from './lib/run';
import type { DefaultSetting } from './macos_defaults';

type Responses = Record<string, Partial<RunResult>>;

// Answers by the command's first words; anything unlisted behaves as not installed.
function stub(responses: Responses): Runner & { calls: string[][] } {
  const calls: string[][] = [];
  const runner = async (cmd: string[]) => {
    calls.push(cmd);
    const key = Object.keys(responses)
      .sort((a, b) => b.length - a.length)
      .find(k => cmd.join(' ').startsWith(k));
    if (key === undefined) return { exitCode: 127, stdout: '', stderr: '' };
    return { exitCode: 0, stdout: '', stderr: '', ...responses[key] };
  };
  return Object.assign(runner, { calls });
}

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'doctor-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('checkBrew', () => {
  it('passes when the Brewfile is satisfied', async () => {
    const runner = stub({ 'brew bundle check': {} });
    expect((await checkBrew(runner, root)).status).toBe('ok');
    expect(runner.calls[0]).toContain('--no-upgrade');
  });

  it('lists the missing packages', async () => {
    const stdout = "brew bundle can't satisfy your Brewfile's dependencies.\n→ Formula fzf needs to be installed or updated.\n→ Cask font-cica needs to be installed or updated.\nSatisfy missing dependencies with `brew bundle install`.\n";
    const result = await checkBrew(stub({ 'brew bundle check': { exitCode: 1, stdout } }), root);
    expect(result).toMatchObject({
      status: 'fail',
      details: ['Formula fzf needs to be installed or updated.', 'Cask font-cica needs to be installed or updated.'],
    });
  });

  it('fails when brew is not installed', async () => {
    expect(await checkBrew(stub({}), root)).toMatchObject({ status: 'fail', details: ['brew is not installed'] });
  });
});

describe('checkVscodeExtensions', () => {
  beforeEach(() => {
    writeFileSync(join(root, 'vscode-extensions.txt'), 'GitHub.copilot\nvscodevim.vim\n\nesbenp.prettier-vscode\n');
  });

  it('compares extension ids case-insensitively', async () => {
    const runner = stub({ 'code --list-extensions': { stdout: 'github.copilot\nvscodevim.vim\nesbenp.prettier-vscode\n' } });
    expect((await checkVscodeExtensions(runner, root)).status).toBe('ok');
  });

  it('lists the missing extensions', async () => {
    const runner = stub({ 'code --list-extensions': { stdout: 'vscodevim.vim\n' } });
    expect(await checkVscodeExtensions(runner, root)).toMatchObject({
      status: 'fail',
      details: ['missing: GitHub.copilot', 'missing: esbenp.prettier-vscode'],
    });
  });

  it('skips when the code command is missing', async () => {
    expect((await checkVscodeExtensions(stub({}), root)).status).toBe('skip');
  });
});

describe('checkStow', () => {
  const simulation = 'WARNING: in simulation mode so not modifying filesystem.\n';

  it('passes when stow has nothing to link', async () => {
    const [result] = await checkStow(stub({ stow: { stderr: simulation } }), '/repo', [{ target: root, packages: ['zsh'] }]);
    expect(result.status).toBe('ok');
  });

  it('runs a dry run against the repo and target', async () => {
    const runner = stub({ stow: {} });
    await checkStow(runner, '/repo', [{ target: root, packages: ['zsh', 'git'] }]);
    expect(runner.calls[0]).toEqual(['stow', '-n', '-v', '-d', '/repo', '-t', root, 'zsh', 'git']);
  });

  it('reports links that are not created yet', async () => {
    const stderr = `LINK: skills/foo => ../../dotfiles/claude/skills/foo\n${simulation}`;
    const [result] = await checkStow(stub({ stow: { stderr } }), '/repo', [{ target: root, packages: ['claude'] }]);
    expect(result.status).toBe('fail');
    expect(result.details).toContain('not linked: LINK: skills/foo => ../../dotfiles/claude/skills/foo');
  });

  it('reports conflicts', async () => {
    const stderr = 'WARNING! stowing zsh would cause conflicts:\n  * existing target is not owned by stow: .zshenv\nAll operations aborted.\n';
    const [result] = await checkStow(stub({ stow: { exitCode: 1, stderr } }), '/repo', [{ target: root, packages: ['zsh'] }]);
    expect(result.status).toBe('fail');
    expect(result.details).toContain('* existing target is not owned by stow: .zshenv');
  });

  it('fails without running stow when the target does not exist', async () => {
    const runner = stub({ stow: {} });
    const [result] = await checkStow(runner, '/repo', [{ target: join(root, 'missing'), packages: ['cursor'] }]);
    expect(result.status).toBe('fail');
    expect(runner.calls).toHaveLength(0);
  });

  it('fails when stow is not installed', async () => {
    const [result] = await checkStow(stub({}), '/repo', [{ target: root, packages: ['zsh'] }]);
    expect(result).toMatchObject({ status: 'fail', details: ['stow is not installed'] });
  });
});

describe('stowTargets', () => {
  // Collects every package that run_stow in `up` passes to `stow -R`.
  function packagesInUp(): string[] {
    const up = readFileSync(join(import.meta.dir, '../up'), 'utf8').replace(/\\\n\s*/g, ' ');
    const body = up.slice(up.indexOf('function run_stow'), up.indexOf('function install_homebrew'));
    return [...body.matchAll(/stow -R -vvv (?:-t "[^"]+" )?([\w -]+)/g)].flatMap(m => m[1].trim().split(/\s+/));
  }

  it('lists the same packages as run_stow in up', () => {
    const packages = stowTargets('/home').flatMap(t => t.packages);
    expect(packages.sort()).toEqual(packagesInUp().sort());
  });
});

describe('checkDefault', () => {
  const global: DefaultSetting = { domain: '-g', key: 'K', type: 'bool', value: false, description: 'd' };
  const app: DefaultSetting = { app: 'Cursor', key: 'K', type: 'bool', value: false, description: 'd' };

  it('passes when the value matches', async () => {
    const runner = stub({ 'defaults read -g K': { stdout: '0\n' } });
    expect((await checkDefault(runner, global)).status).toBe('ok');
  });

  it('fails on a different value', async () => {
    const result = await checkDefault(stub({ 'defaults read -g K': { stdout: '1\n' } }), global);
    expect(result).toMatchObject({ status: 'fail', details: ['expected 0, got 1; run ./up macos'] });
  });

  it('fails when the key is unset', async () => {
    const result = await checkDefault(stub({ 'defaults read -g K': { exitCode: 1, stderr: 'does not exist' } }), global);
    expect(result.details?.[0]).toContain('got (unset)');
  });

  it('reads the bundle id resolved from the app name', async () => {
    const runner = stub({ osascript: { stdout: 'com.todesktop.abc\n' }, 'defaults read com.todesktop.abc K': { stdout: '0\n' } });
    expect((await checkDefault(runner, app)).status).toBe('ok');
    expect(runner.calls[0]).toEqual(['osascript', '-e', 'id of app "Cursor"']);
  });

  it('skips when the app is not installed', async () => {
    const runner = stub({ osascript: { exitCode: 1, stderr: "Can't get application" } });
    expect((await checkDefault(runner, app)).status).toBe('skip');
    expect(runner.calls).toHaveLength(1);
  });
});
