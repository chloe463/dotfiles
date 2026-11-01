import { expect, describe, it, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Runs the real script with a stub `herdr` that records its arguments.

const script = join(import.meta.dir, '../bin/.local/bin/ai-layout');

let root: string;
let callsFile: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ai-layout-'));
  callsFile = join(root, 'calls');
  writeFileSync(callsFile, '');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function run({ paneCount = 1, env = { HERDR_ENV: '1', HERDR_PANE_ID: 'p1' } as Record<string, string> } = {}) {
  const bin = join(root, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(
    join(bin, 'herdr'),
    `#!/bin/bash
echo "$*" >> "${callsFile}"
case "$1 $2" in
  "pane get") echo '{"result":{"pane":{"tab_id":"t1"}}}' ;;
  "tab get") echo '{"result":{"tab":{"pane_count":${paneCount}}}}' ;;
  "pane split")
    n=$(grep -c '^pane split' "${callsFile}")
    echo "{\\"result\\":{\\"pane\\":{\\"pane_id\\":\\"new$n\\"}}}"
    ;;
esac
`,
  );
  chmodSync(join(bin, 'herdr'), 0o755);
  return spawnSync('bash', [script], {
    cwd: root,
    encoding: 'utf8',
    env: { PATH: `${bin}:${process.env.PATH}`, ...env },
  });
}

function calls(): string[] {
  return readFileSync(callsFile, 'utf8').trim().split('\n').filter(Boolean);
}

describe('ai-layout', () => {
  it('splits into four panes and starts the board', () => {
    const result = run();

    expect(result.status).toBe(0);
    const made = calls();
    expect(made.filter((call) => call.startsWith('pane split')).map((call) => call.split(' ').slice(2, 5).join(' '))).toEqual([
      'p1 --direction right',
      'p1 --direction down',
      'new1 --direction down',
    ]);
    expect(made).toContain('pane rename p1 claude-main-session');
    expect(made).toContain('pane rename new1 plan-viewer');
    expect(made).toContain('pane rename new2 workspace-for-human');
    expect(made).toContain('pane rename new3 ai-board');
    expect(made).toContain('pane run new3 ai-board --watch');
  });

  it('starts the viewer when the plan exists', () => {
    mkdirSync(join(root, '.ai_logs/current'), { recursive: true });
    writeFileSync(join(root, '.ai_logs/current/plan.md'), '# plan');

    run();

    expect(calls().some((call) => call.startsWith('pane run new1 nvim -R') && call.endsWith('.ai_logs/current/plan.md'))).toBe(true);
  });

  it('explains how to set the plan when there is none', () => {
    const result = run();

    expect(calls().some((call) => call.startsWith('pane run new1'))).toBe(false);
    expect(result.stderr).toContain('ln -sfn projects/<project> .ai_logs/current');
  });

  it('refuses a tab that already has several panes', () => {
    const result = run({ paneCount: 4 });

    expect(result.status).toBe(1);
    expect(calls().some((call) => call.startsWith('pane split'))).toBe(false);
  });

  it('refuses to run outside herdr', () => {
    expect(run({ env: {} }).status).toBe(2);
    expect(calls()).toEqual([]);
  });
});
