import { expect, describe, it, beforeEach, afterEach } from 'bun:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Runs the real script with a stub `nvim` that records how it was started.

const script = join(import.meta.dir, '../bin/.local/bin/ai-plan');

let root: string;
let repo: string;
let record: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'ai-plan-')));
  repo = join(root, 'repo');
  record = join(root, 'record');
  mkdirSync(repo);
  mkdirSync(join(root, 'bin'));
  writeFileSync(join(root, 'bin/nvim'), `#!/bin/bash\n{ echo "viewer=$AI_PLAN_VIEWER"; printf '%s\\n' "$@"; } > "${record}"\n`);
  chmodSync(join(root, 'bin/nvim'), 0o755);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function git(...args: string[]) {
  execFileSync('git', args, {
    cwd: repo,
    stdio: 'ignore',
    env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@e', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@e' },
  });
}

function writePlan(name: string) {
  mkdirSync(join(repo, '.ai_logs/current'), { recursive: true });
  writeFileSync(join(repo, '.ai_logs/current', name), '# plan');
}

function run(args: string[] = [], cwd = repo) {
  return spawnSync('bash', [script, ...args], {
    cwd,
    encoding: 'utf8',
    env: { PATH: `${join(root, 'bin')}:${process.env.PATH}` },
  });
}

function opened(): string[] {
  return readFileSync(record, 'utf8').trim().split('\n');
}

describe('ai-plan', () => {
  it('opens the given file unmodifiable, reloading, with the viewer plugins on', () => {
    const file = join(root, 'notes.md');
    writeFileSync(file, '# notes');

    expect(run([file], root).status).toBe(0);

    const args = opened();
    expect(args[0]).toBe('viewer=1');
    expect(args.slice(1, 3)).toEqual(['-M', '-n']);
    expect(args).toContain('set autoread');
    expect(args.some((arg) => arg.includes('checktime'))).toBe(true);
    expect(args.at(-1)).toBe(file);
  });

  it('opens plan.md without an argument', () => {
    git('init', '-q');
    writePlan('plan.md');

    expect(run().status).toBe(0);
    expect(opened().at(-1)).toBe(join(repo, '.ai_logs/current/plan.md'));
  });

  it('prefers the newest dated plan, like ai-board', () => {
    git('init', '-q');
    writePlan('20261101_plan.md');
    writePlan('20261201_plan.md');

    run();

    expect(opened().at(-1)).toBe(join(repo, '.ai_logs/current/20261201_plan.md'));
  });

  it("finds the main checkout's plan from a subdirectory and a worktree", () => {
    git('init', '-q');
    git('commit', '-q', '--allow-empty', '-m', 'init');
    writePlan('plan.md');
    const expected = join(repo, '.ai_logs/current/plan.md');

    mkdirSync(join(repo, 'sub'));
    run([], join(repo, 'sub'));
    expect(opened().at(-1)).toBe(expected);

    const worktree = join(root, 'worktree');
    git('worktree', 'add', '-q', '-b', 'other', worktree);
    run([], worktree);
    expect(opened().at(-1)).toBe(expected);
  });

  it('explains how to set the plan when there is none', () => {
    git('init', '-q');

    const result = run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ln -sfn projects/<project> .ai_logs/current');
    expect(existsSync(record)).toBe(false);
  });

  it('fails on a missing file and outside a repository', () => {
    expect(run([join(root, 'missing.md')], root).status).toBe(1);
    expect(run([], root).status).toBe(1);
    expect(existsSync(record)).toBe(false);
  });

  it('rejects extra arguments', () => {
    expect(run(['a.md', 'b.md'], root).status).toBe(1);
  });
});
