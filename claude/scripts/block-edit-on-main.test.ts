import { expect, describe, it, beforeAll, afterAll } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findProtectedEdit,
  isValidPreToolUseData,
  resolveTarget,
  targetPath,
  type GitLookup,
} from "./block-edit-on-main";

const fakeGit = (branch: string, ignored = false): GitLookup => ({
  currentBranch: () => branch,
  isIgnored: () => ignored,
});

describe("targetPath", () => {
  const data = (tool_name: string, tool_input: Record<string, unknown>) => ({
    hook_event_name: "PreToolUse" as const,
    tool_name,
    tool_input,
  });
  it("returns file_path for edit tools", () => {
    expect(targetPath(data("Edit", { file_path: "/r/a.ts" }))).toBe("/r/a.ts");
    expect(targetPath(data("Write", { file_path: "/r/a.ts" }))).toBe("/r/a.ts");
    expect(targetPath(data("MultiEdit", { file_path: "/r/a.ts" }))).toBe("/r/a.ts");
  });
  it("returns notebook_path for NotebookEdit", () => {
    expect(targetPath(data("NotebookEdit", { notebook_path: "/r/a.ipynb" }))).toBe("/r/a.ipynb");
  });
  it("returns null for other tools or a missing path", () => {
    expect(targetPath(data("Read", { file_path: "/r/a.ts" }))).toBeNull();
    expect(targetPath(data("Edit", {}))).toBeNull();
  });
});

describe("findProtectedEdit", () => {
  it("denies on main and master", () => {
    expect(findProtectedEdit("/r/a.ts", fakeGit("main"))).not.toBeNull();
    expect(findProtectedEdit("/r/a.ts", fakeGit("master"))).not.toBeNull();
  });
  it("allows on a feature branch", () => {
    expect(findProtectedEdit("/r/a.ts", fakeGit("feature"))).toBeNull();
    expect(findProtectedEdit("/r/a.ts", fakeGit("main-fix"))).toBeNull();
  });
  it("allows outside a repository or on a detached HEAD", () => {
    expect(findProtectedEdit("/r/a.ts", fakeGit(""))).toBeNull();
  });
  it("allows git-ignored files on main", () => {
    expect(findProtectedEdit("/r/.ai_logs/plan.md", fakeGit("main", true))).toBeNull();
  });
});

describe("isValidPreToolUseData", () => {
  it("rejects malformed input", () => {
    expect(isValidPreToolUseData(null)).toBe(false);
    expect(isValidPreToolUseData([])).toBe(false);
    expect(isValidPreToolUseData({ hook_event_name: "PreToolUse", tool_name: "Edit" })).toBe(false);
  });
});

describe("with a real repository", () => {
  const script = join(import.meta.dir, "block-edit-on-main.ts");
  let root: string;
  let repo: string;

  const git = (...args: string[]) => execFileSync("git", ["-C", repo, ...args], { stdio: "ignore" });
  const run = (tool_name: string, file_path: string) =>
    execFileSync("bun", [script], {
      input: JSON.stringify({ hook_event_name: "PreToolUse", tool_name, tool_input: { file_path } }),
      encoding: "utf8",
    });

  beforeAll(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), "block-edit-on-main-")));
    repo = join(root, "repo");
    execFileSync("git", ["init", "-q", "-b", "main", repo]);
    writeFileSync(join(repo, ".gitignore"), ".ai_logs/\n");
    writeFileSync(join(repo, "tracked.txt"), "x\n");
    // A symlink from outside the repository, like ~/.claude/settings.json
    mkdirSync(join(root, "home"));
    symlinkSync(join(repo, "tracked.txt"), join(root, "home", "link.txt"));
  });
  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("resolves symlinks and not-yet-existing files", () => {
    expect(resolveTarget(join(root, "home", "link.txt"))).toBe(join(repo, "tracked.txt"));
    expect(resolveTarget(join(repo, "new", "dir", "file.ts"))).toBe(join(repo, "new", "dir", "file.ts"));
  });

  it("denies editing a tracked file on main", () => {
    const output = JSON.parse(run("Edit", join(repo, "tracked.txt")));
    expect(output.hookSpecificOutput.permissionDecision).toBe("deny");
  });

  it("denies writing a new file in a new directory on main", () => {
    expect(JSON.parse(run("Write", join(repo, "src", "new.ts"))).hookSpecificOutput.permissionDecision).toBe(
      "deny",
    );
  });

  it("denies editing through a symlink that points into the repository", () => {
    expect(JSON.parse(run("Edit", join(root, "home", "link.txt"))).hookSpecificOutput.permissionDecision).toBe(
      "deny",
    );
  });

  it("allows git-ignored files on main", () => {
    expect(run("Write", join(repo, ".ai_logs", "2026", "plan.md"))).toBe("");
  });

  it("allows files outside a repository", () => {
    expect(run("Write", join(root, "home", "notes.md"))).toBe("");
  });

  it("prints nothing for invalid JSON", () => {
    expect(execFileSync("bun", [script], { input: "not json", encoding: "utf8" })).toBe("");
  });

  // Last: leaves the repository on the feature branch
  it("allows edits after switching to a feature branch", () => {
    git("switch", "-q", "-c", "feature");
    expect(run("Edit", join(repo, "tracked.txt"))).toBe("");
  });
});
