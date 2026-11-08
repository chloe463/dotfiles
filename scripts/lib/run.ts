// Command runner shared by doctor and macos_defaults. It is injected into the
// checks so tests can replace it with a stub instead of touching the machine.

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type Runner = (cmd: string[]) => Promise<RunResult>;

// A command that is not on PATH comes back as exit code 127 (like a shell)
// instead of throwing, so callers can treat "not installed" as a result.
export const run: Runner = async cmd => {
  let proc;
  try {
    proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe', stdin: 'ignore' });
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
