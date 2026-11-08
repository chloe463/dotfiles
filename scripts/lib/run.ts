// Command runner shared by doctor and macos_defaults. It is injected into the
// checks so tests can replace it with a stub instead of touching the machine.

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type Runner = (cmd: string[], opts?: { cwd?: string }) => Promise<RunResult>;

// Like a shell, a command that is not on PATH comes back as exit code 127
// instead of throwing, so callers can treat "not installed" as a result. Any
// other spawn failure (missing cwd, no execute permission) is 126 with the
// original error, so it isn't mistaken for a missing tool.
export const run: Runner = async (cmd, opts = {}) => {
  let proc;
  try {
    proc = Bun.spawn(cmd, { cwd: opts.cwd, stdout: 'pipe', stderr: 'pipe', stdin: 'ignore' });
  } catch (e) {
    const notFound = (e as { code?: string }).code === 'ENOENT' && /not found in \$PATH/.test(String(e));
    return { exitCode: notFound ? 127 : 126, stdout: '', stderr: String(e) };
  }
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, stdout, stderr };
};

export type AppLookup = { kind: 'installed'; id: string } | { kind: 'missing' } | { kind: 'error'; message: string };

// Looks up an app's bundle id. Only osascript's "Can't get application"
// (-1728) means the app isn't installed; any other failure (LaunchServices
// trouble, no GUI session over SSH, a sandbox) is an error, so callers don't
// report it as a skipped app.
export async function lookupApp(runner: Runner, app: string): Promise<AppLookup> {
  const res = await runner(['osascript', '-e', `id of app "${app}"`]);
  const id = res.stdout.trim();
  if (res.exitCode === 0 && id) return { kind: 'installed', id };
  if (res.exitCode === 1 && res.stderr.includes('(-1728)')) return { kind: 'missing' };
  const message = res.stderr.trim() || `osascript exited with ${res.exitCode} and printed no bundle id`;
  return { kind: 'error', message: `could not look up ${app}: ${message}` };
}
