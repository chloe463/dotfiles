import { afterEach, beforeEach, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const SCRIPT = join(import.meta.dir, "git_sync.ts");
// Real git, but no user config and no git-delete-squashed on PATH.
const ENV = {
  PATH: `${dirname(process.execPath)}:${dirname(Bun.which("git")!)}:/usr/bin:/bin`,
  HOME: tmpdir(),
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.com",
};
let dir: string;

function git(cwd: string, ...args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], { cwd, env: ENV, stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.toString();
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "git-sync-"));
  git(dir, "init", "-q", "--bare", "-b", "main", "origin.git");
  git(dir, "clone", "-q", "origin.git", "work");
  const work = join(dir, "work");
  git(work, "commit", "-q", "--allow-empty", "-m", "init");
  git(work, "push", "-q", "origin", "main");
  git(work, "branch", "merged");
  git(work, "worktree", "add", "-q", "-b", "in-worktree", join(dir, "wt"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

it("deletes merged branches but leaves ones checked out in another worktree", () => {
  const work = join(dir, "work");
  const result = Bun.spawnSync(["bun", SCRIPT], { cwd: work, env: ENV, stderr: "pipe" });

  expect(result.stderr.toString()).not.toContain("git branch -d");
  expect(result.exitCode).toBe(0);
  const branches = git(work, "branch", "--format=%(refname:short)").split("\n").filter(Boolean);
  expect(branches.sort()).toEqual(["in-worktree", "main"]);
});
