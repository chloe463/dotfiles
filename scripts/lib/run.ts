// Command runner shared by doctor and macos_defaults. It is injected into the
// checks so tests can replace it with a stub instead of touching the machine.

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type Runner = (cmd: string[], opts?: { cwd?: string }) => Promise<RunResult>;

// A command that is not on PATH comes back as exit code 127 (like a shell)
// instead of throwing, so callers can treat "not installed" as a result.
export const run: Runner = async (cmd, opts = {}) => {
  let proc;
  try {
    proc = Bun.spawn(cmd, { cwd: opts.cwd, stdout: 'pipe', stderr: 'pipe', stdin: 'ignore' });
  } catch {
    return { exitCode: 127, stdout: '', stderr: `command not found: ${cmd[0]}` };
  }
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, stdout, stderr };
};

// The bundle id of an installed app, or null when it isn't installed.
export async function bundleIdOf(runner: Runner, app: string): Promise<string | null> {
  const res = await runner(['osascript', '-e', `id of app "${app}"`]);
  const id = res.stdout.trim();
  return res.exitCode === 0 && id ? id : null;
}
