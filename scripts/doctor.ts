#!/usr/bin/env bun
// Checks that this machine matches the dotfiles: Homebrew packages, VS Code
// extensions, stow symlinks and macOS `defaults`. Read-only; exits 1 when
// anything fails. Run it with `./up doctor`.

import chalk from 'chalk';
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { bundleIdOf, run, type Runner } from './lib/run';
import { SETTINGS, encodeRead, resolveDomain, settingLabel, type DefaultSetting } from './macos_defaults';

export type Status = 'ok' | 'fail' | 'skip';

export interface CheckResult {
  name: string;
  status: Status;
  details?: string[];
}

export interface StowTarget {
  target: string;
  packages: string[];
  // Stowed with --no-folding, for packages with tests in subdirectories.
  noFolding?: boolean;
  // Checked only when this app is installed and the target directory exists.
  app?: string;
}

// Must match run_stow in `up` (doctor.test.ts checks this).
export function stowTargets(home: string): StowTarget[] {
  const support = join(home, 'Library/Application Support');
  return [
    {
      target: home,
      packages: ['alacritty', 'any-script-mcp', 'bat', 'gh', 'git', 'herdr', 'hunk', 'nvim', 'runok', 'starship', 'zsh', 'bin'],
    },
    { target: join(support, 'Code/User'), packages: ['vscode'] },
    { target: join(support, 'Cursor/User'), packages: ['cursor'], app: 'Cursor' },
    { target: join(home, '.claude'), packages: ['claude'], noFolding: true },
    { target: join(home, 'scripts'), packages: ['scripts'], noFolding: true },
  ];
}

const lines = (s: string) =>
  s
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

const notInstalled = (tool: string): CheckResult => ({ name: tool, status: 'fail', details: [`${tool} is not installed`] });

// Only missing packages count; outdated ones are `brew upgrade`'s business.
export async function checkBrew(runner: Runner, repo: string): Promise<CheckResult> {
  const name = 'Homebrew packages (Brewfile.shared)';
  const res = await runner(['brew', 'bundle', 'check', '--no-upgrade', '--verbose', `--file=${join(repo, 'Brewfile.shared')}`]);
  if (res.exitCode === 127) return { ...notInstalled('brew'), name };
  if (res.exitCode === 0) return { name, status: 'ok' };
  const missing = lines(res.stdout)
    .filter(l => l.startsWith('→'))
    .map(l => l.replace(/^→\s*/, ''));
  return { name, status: 'fail', details: missing.length ? missing : lines(res.stdout + res.stderr) };
}

export async function checkVscodeExtensions(runner: Runner, repo: string): Promise<CheckResult> {
  const name = 'VS Code extensions (vscode-extensions.txt)';
  const res = await runner(['code', '--list-extensions']);
  if (res.exitCode === 127) return { name, status: 'skip', details: ['code command not found'] };
  if (res.exitCode !== 0) return { name, status: 'fail', details: lines(res.stderr) };
  const installed = new Set(lines(res.stdout).map(e => e.toLowerCase()));
  const missing = lines(readFileSync(join(repo, 'vscode-extensions.txt'), 'utf8')).filter(
    e => !e.startsWith('#') && !installed.has(e.toLowerCase())
  );
  return missing.length
    ? { name, status: 'fail', details: missing.map(e => `missing: ${e}`) }
    : { name, status: 'ok' };
}

const tilde = (p: string) => p.replace(homedir(), '~');

// `stow -n -v` (no -R) prints a LINK: line only for links that don't exist
// yet and exits non-zero on conflicts, so a clean run means everything is linked.
// It runs in the repo so stow reads the --ignore rules in .stowrc, like `up` does.
export async function checkStow(runner: Runner, repo: string, targets: StowTarget[]): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const { target, packages, noFolding, app } of targets) {
    const name = `stow ${packages.join(' ')} → ${tilde(target)}`;
    if (app !== undefined && (await bundleIdOf(runner, app)) === null) {
      results.push({ name, status: 'skip', details: [`${app} is not installed`] });
      continue;
    }
    if (!existsSync(target)) {
      results.push(
        app === undefined
          ? { name, status: 'fail', details: ['target directory does not exist; run ./up dot'] }
          : { name, status: 'skip', details: ['target directory does not exist'] }
      );
      continue;
    }
    const folding = noFolding ? ['--no-folding'] : [];
    const res = await runner(['stow', '-n', '-v', ...folding, '-d', repo, '-t', target, ...packages], { cwd: repo });
    if (res.exitCode === 127) {
      results.push({ ...notInstalled('stow'), name });
      continue;
    }
    const output = lines(res.stdout + '\n' + res.stderr).filter(l => !l.startsWith('WARNING: in simulation mode'));
    if (res.exitCode !== 0) {
      results.push({ name, status: 'fail', details: output });
      continue;
    }
    const pending = output.filter(l => l.startsWith('LINK:') || l.startsWith('MKDIR:'));
    results.push(
      pending.length
        ? { name, status: 'fail', details: [...pending.map(l => `not linked: ${l}`), 'run ./up dot'] }
        : { name, status: 'ok' }
    );
  }
  return results;
}

// The --ignore rules in .stowrc. Like stow, a rule without a slash matches
// the end of a file's basename.
export function parseStowIgnores(stowrc: string): RegExp[] {
  return lines(stowrc)
    .filter(l => l.startsWith('--ignore='))
    .map(l => new RegExp(`(?:${l.slice('--ignore='.length)})$`));
}

export interface ExposedFile {
  path: string;
  // true: a link to the file itself, which stow won't remove because it now
  // ignores the file. false: reachable through a tree-folded parent directory,
  // which a restow with --no-folding replaces.
  linked: boolean;
}

// Ignored files (tests) of the packages that can still be reached from the
// targets. This happens on machines stowed before .stowrc existed: stow never
// unstows files it ignores, and its dry run accepts an existing folded
// directory link, so checkStow can't see either case.
export function findExposedFiles(repo: string, targets: StowTarget[], ignores: RegExp[]): ExposedFile[] {
  const found: ExposedFile[] = [];
  for (const { target, packages } of targets) {
    for (const pkg of packages) {
      const root = join(repo, pkg);
      if (!existsSync(root)) continue;
      for (const rel of readdirSync(root, { recursive: true }) as string[]) {
        if (!ignores.some(r => r.test(basename(rel)))) continue;
        const dest = join(target, rel);
        try {
          if (realpathSync(dest) === realpathSync(join(root, rel))) {
            found.push({ path: dest, linked: lstatSync(dest).isSymbolicLink() });
          }
        } catch {
          // dest doesn't exist or is a dangling link: nothing is exposed
        }
      }
    }
  }
  return found;
}

export function checkExposedFiles(repo: string, targets: StowTarget[]): CheckResult {
  const name = 'files ignored by .stowrc are not reachable from the targets';
  const stowrc = join(repo, '.stowrc');
  const ignores = existsSync(stowrc) ? parseStowIgnores(readFileSync(stowrc, 'utf8')) : [];
  const found = findExposedFiles(repo, targets, ignores);
  if (found.length === 0) return { name, status: 'ok' };
  const linked = found.filter(f => f.linked);
  const folded = found.filter(f => !f.linked);
  const details: string[] = [];
  if (linked.length) {
    details.push(...linked.map(f => `linked: ${tilde(f.path)}`), 'stow no longer manages these links; remove them by hand');
  }
  if (folded.length) {
    details.push(...folded.map(f => `via a folded directory: ${tilde(f.path)}`), 'run ./up dot to unfold the directories');
  }
  return { name, status: 'fail', details };
}

export async function checkDefault(runner: Runner, setting: DefaultSetting): Promise<CheckResult> {
  const name = `defaults ${settingLabel(setting)} — ${setting.description}`;
  const domain = await resolveDomain(setting, runner);
  if (domain === null) return { name, status: 'skip', details: ['app not installed'] };
  const res = await runner(['defaults', 'read', domain, setting.key]);
  const expected = encodeRead(setting);
  const actual = res.exitCode === 0 ? res.stdout.trim() : '(unset)';
  return actual === expected
    ? { name, status: 'ok' }
    : { name, status: 'fail', details: [`expected ${expected}, got ${actual}; run ./up macos`] };
}

export async function runChecks(runner: Runner, repo: string, home: string): Promise<CheckResult[]> {
  return [
    await checkBrew(runner, repo),
    await checkVscodeExtensions(runner, repo),
    ...(await checkStow(runner, repo, stowTargets(home))),
    checkExposedFiles(repo, stowTargets(home)),
    ...(await Promise.all(SETTINGS.map(s => checkDefault(runner, s)))),
  ];
}

export function render(results: CheckResult[]): string {
  const mark = { ok: chalk.green('✓'), fail: chalk.red('✗'), skip: chalk.dim('-') };
  const out: string[] = [];
  for (const r of results) {
    out.push(`${mark[r.status]} ${r.status === 'skip' ? chalk.dim(r.name) : r.name}`);
    for (const d of r.details ?? []) out.push(chalk.dim(`    ${d}`));
  }
  const count = (s: Status) => results.filter(r => r.status === s).length;
  out.push('', `${count('ok')} ok, ${count('fail')} failed, ${count('skip')} skipped`);
  return out.join('\n');
}

async function main() {
  const repo = resolve(realpathSync(import.meta.dir), '..');
  const results = await runChecks(run, repo, homedir());
  console.log(render(results));
  if (results.some(r => r.status === 'fail')) process.exit(1);
}

if (import.meta.main) await main();
