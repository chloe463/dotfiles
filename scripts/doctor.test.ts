import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkBrew,
  checkDefault,
  checkExposedFiles,
  checkStow,
  checkVscodeExtensions,
  findExposedFiles,
  parseStowIgnores,
  stowTargets,
} from './doctor';
import type { RunResult, Runner } from './lib/run';
import type { DefaultSetting } from './macos_defaults';

type Responses = Record<string, Partial<RunResult>>;

// Answers by the command's first words; anything unlisted behaves as not installed.
function stub(responses: Responses): Runner & { calls: string[][]; cwds: (string | undefined)[] } {
  const calls: string[][] = [];
  const cwds: (string | undefined)[] = [];
  const runner = async (cmd: string[], opts?: { cwd?: string }) => {
    calls.push(cmd);
    cwds.push(opts?.cwd);
    const key = Object.keys(responses)
      .sort((a, b) => b.length - a.length)
      .find(k => cmd.join(' ').startsWith(k));
    if (key === undefined) return { exitCode: 127, stdout: '', stderr: '' };
    return { exitCode: 0, stdout: '', stderr: '', ...responses[key] };
  };
  return Object.assign(runner, { calls, cwds });
}

// What osascript prints for an app that isn't installed.
const appMissing = { exitCode: 1, stderr: '0:9: execution error: Can’t get application "Cursor". (-1728)\n' };

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

  it('fails when the code command is missing, since VS Code is in the Brewfile', async () => {
    expect((await checkVscodeExtensions(stub({}), root)).status).toBe('fail');
  });
});

describe('checkStow', () => {
  const simulation = 'WARNING: in simulation mode so not modifying filesystem.\n';

  it('passes when stow has nothing to link', async () => {
    const [result] = await checkStow(stub({ stow: { stderr: simulation } }), '/repo', [{ target: root, packages: ['zsh'] }]);
    expect(result.status).toBe('ok');
  });

  it('runs a dry run in the repo so stow reads .stowrc', async () => {
    const runner = stub({ stow: {} });
    await checkStow(runner, '/repo', [{ target: root, packages: ['zsh', 'git'] }]);
    expect(runner.calls[0]).toEqual(['stow', '-n', '-v', '-d', '/repo', '-t', root, 'zsh', 'git']);
    expect(runner.cwds[0]).toBe('/repo');
  });

  it('passes --no-folding for packages stowed without folding', async () => {
    const runner = stub({ stow: {} });
    await checkStow(runner, '/repo', [{ target: root, packages: ['claude'], noFolding: true }]);
    expect(runner.calls[0]).toEqual(['stow', '-n', '-v', '--no-folding', '-d', '/repo', '-t', root, 'claude']);
  });

  describe('a target tied to an app', () => {
    it('skips without running stow when the app is not installed', async () => {
      const runner = stub({ osascript: appMissing, stow: {} });
      const [result] = await checkStow(runner, '/repo', [{ target: root, packages: ['cursor'], app: 'Cursor' }]);
      expect(result).toMatchObject({ status: 'skip', details: ['Cursor is not installed'] });
      expect(runner.calls.map(c => c[0])).toEqual(['osascript']);
    });

    it('fails when the app lookup itself fails', async () => {
      const runner = stub({ osascript: { exitCode: 1, stderr: 'execution error: An error of type -600 has occurred. (-600)\n' }, stow: {} });
      const [result] = await checkStow(runner, '/repo', [{ target: root, packages: ['cursor'], app: 'Cursor' }]);
      expect(result.status).toBe('fail');
      expect(result.details?.[0]).toContain('(-600)');
    });

    it('skips when the target directory does not exist', async () => {
      const runner = stub({ osascript: { stdout: 'com.todesktop.abc\n' }, stow: {} });
      const [result] = await checkStow(runner, '/repo', [{ target: join(root, 'missing'), packages: ['cursor'], app: 'Cursor' }]);
      expect(result).toMatchObject({ status: 'skip', details: ['target directory does not exist'] });
    });

    it('checks the links when the app is installed and the target exists', async () => {
      const stderr = 'LINK: settings.json => ../dotfiles/cursor/settings.json\n';
      const runner = stub({ osascript: { stdout: 'com.todesktop.abc\n' }, stow: { stderr } });
      const [result] = await checkStow(runner, '/repo', [{ target: root, packages: ['cursor'], app: 'Cursor' }]);
      expect(result.status).toBe('fail');
    });
  });

  it('reports links that are not created yet', async () => {
    const stderr = `LINK: skills/foo => ../../dotfiles/claude/skills/foo\n${simulation}`;
    const [result] = await checkStow(stub({ stow: { stderr } }), '/repo', [{ target: root, packages: ['claude'] }]);
    expect(result.status).toBe('fail');
    expect(result.details).toContain('not linked: LINK: skills/foo => ../../dotfiles/claude/skills/foo');
  });

  it('reports directories that are not created yet', async () => {
    const stderr = `MKDIR: skills/foo\n${simulation}`;
    const [result] = await checkStow(stub({ stow: { stderr } }), '/repo', [{ target: root, packages: ['claude'], noFolding: true }]);
    expect(result.status).toBe('fail');
    expect(result.details).toContain('not linked: MKDIR: skills/foo');
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
  // The `stow -R` calls in run_stow in `up`, as packages and --no-folding.
  function stowCallsInUp(): { packages: string[]; noFolding: boolean }[] {
    const up = readFileSync(join(import.meta.dir, '../up'), 'utf8').replace(/\\\n\s*/g, ' ');
    const body = up.slice(up.indexOf('function run_stow'), up.indexOf('function install_homebrew'));
    return [...body.matchAll(/^\s*(?:if ! )?stow -R ([^;\n]+?)(?:;|$)/gm)].map(([, args]) => {
      const words: string[] = args.match(/"[^"]*"|\S+/g) ?? [];
      const packages = words.filter((w, i) => !w.startsWith('-') && words[i - 1] !== '-t');
      return { packages, noFolding: words.includes('--no-folding') };
    });
  }

  it('matches the stow calls in run_stow in up', () => {
    const fromUp = stowCallsInUp();
    expect(fromUp.length).toBeGreaterThan(0);
    const sort = (calls: { packages: string[]; noFolding: boolean }[]) =>
      calls.map(c => `${[...c.packages].sort().join(' ')}${c.noFolding ? ' --no-folding' : ''}`).sort();
    // run_stow stows bin in a call of its own; doctor checks it with the other $HOME packages.
    const merged = fromUp.filter(c => !c.packages.includes('bin'));
    merged[merged.findIndex(c => c.packages.includes('zsh'))].packages.push('bin');
    expect(sort(stowTargets('/home').map(t => ({ packages: t.packages, noFolding: !!t.noFolding })))).toEqual(sort(merged));
  });
});

describe('.stowrc', () => {
  // Paths relative to a package, which is what stow matches --ignore against.
  const ignores = parseStowIgnores(readFileSync(join(import.meta.dir, '../.stowrc'), 'utf8'));
  const ignored = (path: string) => ignores.some(r => r.test(path));

  it.each([
    'doctor.test.ts',
    'scripts/lib/shell.test.ts',
    'test_statusline.sh',
    'skills/x/test_y.sh',
  ])('ignores %s', path => {
    expect(ignored(path)).toBe(true);
  });

  it.each([
    'doctor.ts',
    'statusline.ts',
    'skills/x/create-worktree.sh',
    'latest_test.sh',
    'skills/x/latest_test.sh',
    'test_dir/run.sh',
  ])('keeps %s', path => {
    expect(ignored(path)).toBe(false);
  });
});

describe('findExposedFiles', () => {
  const ignores = parseStowIgnores('--ignore=\\.test\\.ts\n--ignore=(^|/)test_[^/]*\\.sh\n');
  let repo: string;
  let target: string;

  beforeEach(() => {
    repo = join(root, 'repo');
    target = join(root, 'target');
    mkdirSync(join(repo, 'pkg/scripts'), { recursive: true });
    mkdirSync(target);
    for (const f of ['a.ts', 'a.test.ts', 'test_a.sh', 'scripts/b.ts', 'scripts/b.test.ts', 'scripts/test_b.sh']) {
      writeFileSync(join(repo, 'pkg', f), '');
    }
  });

  const find = () => findExposedFiles(repo, [{ target, packages: ['pkg'] }], ignores);

  it('reports nothing when only regular files are linked', () => {
    symlinkSync(join(repo, 'pkg/a.ts'), join(target, 'a.ts'));
    mkdirSync(join(target, 'scripts'));
    symlinkSync(join(repo, 'pkg/scripts/b.ts'), join(target, 'scripts/b.ts'));
    expect(find()).toEqual([]);
  });

  it('reports links to ignored files left from before .stowrc', () => {
    symlinkSync(join(repo, 'pkg/a.test.ts'), join(target, 'a.test.ts'));
    symlinkSync(join(repo, 'pkg/test_a.sh'), join(target, 'test_a.sh'));
    expect(find()).toEqual([
      { path: join(target, 'a.test.ts'), linked: true },
      { path: join(target, 'test_a.sh'), linked: true },
    ]);
  });

  it('reports ignored files reachable through a folded directory', () => {
    symlinkSync(join(repo, 'pkg/scripts'), join(target, 'scripts'));
    expect(find()).toEqual([
      { path: join(target, 'scripts/b.test.ts'), linked: false },
      { path: join(target, 'scripts/test_b.sh'), linked: false },
    ]);
  });

  it('matches the rules against the path in the package, like stow', () => {
    const rootOnly = parseStowIgnores('--ignore=^test_.*\\.sh\n');
    mkdirSync(join(target, 'scripts'));
    symlinkSync(join(repo, 'pkg/test_a.sh'), join(target, 'test_a.sh'));
    symlinkSync(join(repo, 'pkg/scripts/test_b.sh'), join(target, 'scripts/test_b.sh'));
    // stow links scripts/test_b.sh despite this rule, so it isn't "exposed".
    expect(findExposedFiles(repo, [{ target, packages: ['pkg'] }], rootOnly)).toEqual([
      { path: join(target, 'test_a.sh'), linked: true },
    ]);
  });

  it('ignores a file of the same name that is not a link into the repo', () => {
    writeFileSync(join(target, 'a.test.ts'), '');
    expect(find()).toEqual([]);
  });

  it('fails when .stowrc has no ignore rules', () => {
    writeFileSync(join(repo, '.stowrc'), "--ignore '\\.test\\.ts'\n");
    expect(checkExposedFiles(repo, [{ target, packages: ['pkg'] }])).toMatchObject({
      status: 'fail',
      details: ['no --ignore=<regex> rules found in .stowrc'],
    });
  });

  it('fails the check with a hint for each case', () => {
    writeFileSync(join(repo, '.stowrc'), '--ignore=\\.test\\.ts\n');
    symlinkSync(join(repo, 'pkg/a.test.ts'), join(target, 'a.test.ts'));
    symlinkSync(join(repo, 'pkg/scripts'), join(target, 'scripts'));
    const result = checkExposedFiles(repo, [{ target, packages: ['pkg'] }]);
    expect(result.status).toBe('fail');
    expect(result.details).toContain('stow no longer manages these links; remove them by hand');
    expect(result.details).toContain('run ./up dot to unfold the directories');
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
    const stderr = 'The domain/default pair of (kCFPreferencesAnyApplication, K) does not exist\n';
    const result = await checkDefault(stub({ 'defaults read -g K': { exitCode: 1, stderr } }), global);
    expect(result.details?.[0]).toContain('got (unset)');
  });

  it('shows the error when defaults read fails for another reason', async () => {
    const result = await checkDefault(stub({ 'defaults read -g K': { exitCode: 1, stderr: 'boom\n' } }), global);
    expect(result).toMatchObject({ status: 'fail', details: ['boom'] });
  });

  it('reads the bundle id resolved from the app name', async () => {
    const runner = stub({ osascript: { stdout: 'com.todesktop.abc\n' }, 'defaults read com.todesktop.abc K': { stdout: '0\n' } });
    expect((await checkDefault(runner, app)).status).toBe('ok');
    expect(runner.calls[0]).toEqual(['osascript', '-e', 'id of app "Cursor"']);
  });

  it('skips when the app is not installed', async () => {
    const runner = stub({ osascript: appMissing });
    expect((await checkDefault(runner, app)).status).toBe('skip');
    expect(runner.calls).toHaveLength(1);
  });

  it('fails when the app lookup itself fails', async () => {
    const runner = stub({ osascript: { exitCode: 1, stderr: 'No user interaction allowed. (-1713)\n' } });
    expect((await checkDefault(runner, app)).status).toBe('fail');
  });
});
