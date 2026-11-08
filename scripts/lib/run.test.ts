import { describe, expect, it } from 'bun:test';
import { lookupApp, run, type RunResult } from './run';

describe('run', () => {
  it('returns the output and exit code', async () => {
    expect(await run(['sh', '-c', 'echo out; echo err >&2; exit 3'])).toEqual({ exitCode: 3, stdout: 'out\n', stderr: 'err\n' });
  });

  it('returns 127 for a command that is not on PATH', async () => {
    expect((await run(['__no_such_command__'])).exitCode).toBe(127);
  });

  it('returns 126 with the error for other spawn failures', async () => {
    const res = await run(['ls'], { cwd: '/__no_such_directory__' });
    expect(res.exitCode).toBe(126);
    expect(res.stderr).toContain('ENOENT');
  });
});

describe('lookupApp', () => {
  const answer = (res: Partial<RunResult>) => async () => ({ exitCode: 0, stdout: '', stderr: '', ...res });

  it('returns the bundle id of an installed app', async () => {
    expect(await lookupApp(answer({ stdout: 'com.todesktop.abc\n' }), 'Cursor')).toEqual({ kind: 'installed', id: 'com.todesktop.abc' });
  });

  it('treats only -1728 as not installed', async () => {
    const stderr = '0:20: execution error: Can’t get application "Cursor". (-1728)\n';
    expect(await lookupApp(answer({ exitCode: 1, stderr }), 'Cursor')).toEqual({ kind: 'missing' });
  });

  it('reports other osascript failures as errors', async () => {
    const res = await lookupApp(answer({ exitCode: 1, stderr: 'No user interaction allowed. (-1713)\n' }), 'Cursor');
    expect(res).toEqual({ kind: 'error', message: 'could not look up Cursor: No user interaction allowed. (-1713)' });
  });

  it('reports a successful run without a bundle id as an error', async () => {
    expect((await lookupApp(answer({}), 'Cursor')).kind).toBe('error');
  });

  it('reports a missing osascript as an error', async () => {
    expect((await lookupApp(answer({ exitCode: 127 }), 'Cursor')).kind).toBe('error');
  });
});
