import { describe, expect, it } from 'bun:test';
import type { RunResult, Runner } from './lib/run';
import { applyAll, type DefaultSetting } from './macos_defaults';

function stub(answer: (cmd: string[]) => Partial<RunResult>): Runner & { calls: string[][] } {
  const calls: string[][] = [];
  const runner = async (cmd: string[]) => {
    calls.push(cmd);
    return { exitCode: 0, stdout: '', stderr: '', ...answer(cmd) };
  };
  return Object.assign(runner, { calls });
}

const global: DefaultSetting = { domain: '-g', key: 'K', type: 'bool', value: false, description: 'd' };
const app: DefaultSetting = { app: 'Cursor', key: 'P', type: 'bool', value: true, description: 'd' };

describe('applyAll', () => {
  it('writes each setting to its domain', async () => {
    const runner = stub(cmd => (cmd[0] === 'osascript' ? { stdout: 'com.example.cursor\n' } : {}));
    const outcomes = await applyAll([global, app], runner);
    expect(outcomes.map(o => o.result)).toEqual(['written', 'written']);
    expect(runner.calls.filter(c => c[0] === 'defaults')).toEqual([
      ['defaults', 'write', '-g', 'K', '-bool', 'false'],
      ['defaults', 'write', 'com.example.cursor', 'P', '-bool', 'true'],
    ]);
  });

  it('skips apps that are not installed', async () => {
    const runner = stub(() => ({ exitCode: 1, stderr: 'execution error: Can’t get application "Cursor". (-1728)\n' }));
    const [outcome] = await applyAll([app], runner);
    expect(outcome.result).toBe('skipped');
    expect(runner.calls.some(c => c[0] === 'defaults')).toBe(false);
  });

  it('fails instead of skipping when the app lookup fails', async () => {
    const runner = stub(() => ({ exitCode: 1, stderr: 'No user interaction allowed. (-1713)\n' }));
    const [outcome] = await applyAll([app], runner);
    expect(outcome.result).toBe('failed');
    expect(outcome.message).toContain('(-1713)');
    expect(runner.calls.some(c => c[0] === 'defaults')).toBe(false);
  });

  it('reports a failed write', async () => {
    const [outcome] = await applyAll([global], stub(() => ({ exitCode: 1, stderr: 'boom\n' })));
    expect(outcome).toMatchObject({ result: 'failed', message: 'boom' });
  });
});
