import { expect, describe, it, beforeAll, afterAll } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findClosingCommand,
  findClosingReference,
  messageSources,
  parseMessageCommand,
} from "./block-issue-close-keywords";

const noFiles = () => "";

describe("findClosingReference", () => {
  it.each([
    "Fixes #12",
    "fix #1",
    "fixed #1",
    "Closes #3",
    "close #3",
    "closed #3",
    "Resolves #4",
    "resolve #4",
    "resolved #4",
    "CLOSES #5",
    "Fixes: #6",
    "fixes owner/repo#7",
    "feat: x\n\nThis fixes #8 for good",
  ])("matches %p", (text) => {
    expect(findClosingReference(text)).not.toBeNull();
  });

  it.each([
    "Refs #12",
    "related to #12",
    "hotfix #12",
    "prefix #12",
    "fixes the bug",
    "fixes #",
    "closes issue #12",
    "fix(api): handle null",
  ])("ignores %p", (text) => {
    expect(findClosingReference(text)).toBeNull();
  });
});

describe("messageSources", () => {
  const flags = { short: { m: "text" as const, F: "file" as const }, long: { "--message": "text" as const, "--file": "file" as const } };
  it("reads separate, =-joined, fused and combined forms", () => {
    expect(messageSources(["-m", "a", "--message=b", "-mc", "-am", "d", "-F", "f", "--file", "g"], flags)).toEqual([
      { kind: "text", value: "a" },
      { kind: "text", value: "b" },
      { kind: "text", value: "c" },
      { kind: "text", value: "d" },
      { kind: "file", value: "f" },
      { kind: "file", value: "g" },
    ]);
  });
  it("ignores other flags and stops at --", () => {
    expect(messageSources(["--amend", "-v", "--", "-m", "x"], flags)).toEqual([]);
  });
});

describe("parseMessageCommand", () => {
  it("recognizes git commit with -C", () => {
    expect(parseMessageCommand(["git", "-C", "sub", "commit", "-m", "x"], "/r")).toEqual({
      label: "commit message",
      dir: "/r/sub",
      sources: [{ kind: "text", value: "x" }],
    });
  });
  it("recognizes gh pr create with -R", () => {
    expect(parseMessageCommand(["gh", "-R", "o/r", "pr", "create", "-t", "t", "-b", "body"], "/r")?.sources).toEqual([
      { kind: "text", value: "body" },
    ]);
  });
  it("ignores other commands", () => {
    expect(parseMessageCommand(["git", "log", "-m"], "/r")).toBeNull();
    expect(parseMessageCommand(["gh", "pr", "edit", "-b", "Fixes #1"], "/r")).toBeNull();
    expect(parseMessageCommand(["echo", "git", "commit"], "/r")).toBeNull();
  });
});

describe("findClosingCommand", () => {
  it.each([
    'git commit -m "fix: x" -m "Closes #12"',
    "git commit -am 'Fixes #1'",
    'gh pr create --title t --body "Fixes owner/repo#3"',
    'gh pr create -t t --body="resolves #4"',
    'git commit -m "$(cat <<\'EOF\'\nfeat: x\n\nFixes #5\nEOF\n)"',
    "git commit -F - <<'EOF'\nfeat: x\n\nCloses #6\nEOF",
    "cat <<EOF | git commit -F -\nfixes #7\nEOF",
    "gh pr create --title t --body-file - <<< 'Fixes #8'",
    'git add . && git commit -m "Fixes #9" && git push',
  ])("denies %p", (command) => {
    expect(findClosingCommand(command, "/r", noFiles)).not.toBeNull();
  });

  it.each([
    'git commit -m "fix(api): handle null" -m "Refs #12"',
    'gh pr create --title "Fixes #1" --body "Refs #1"',
    'git log --grep "Fixes #1"',
    'echo "Fixes #1"',
    "cat <<EOF > notes.md\nFixes #1\nEOF\ngit commit -m x",
  ])("allows %p", (command) => {
    expect(findClosingCommand(command, "/r", noFiles)).toBeNull();
  });

  it("reads -F and --body-file relative to the command's directory", () => {
    const files: Record<string, string> = { "/r/sub/msg.txt": "Fixes #1", "/r/body.md": "Closes #2" };
    const read = (path: string) => files[path] ?? "";
    expect(findClosingCommand("git -C sub commit -F msg.txt", "/r", read)).toContain("Fixes #1");
    expect(findClosingCommand("cd sub && git commit --file=msg.txt", "/r", read)).toContain("Fixes #1");
    expect(findClosingCommand("gh pr create --body-file body.md", "/r", read)).toContain("Closes #2");
    expect(findClosingCommand("git commit -F other.txt", "/r", read)).toBeNull();
  });
});

describe("hook script", () => {
  const script = join(import.meta.dir, "block-issue-close-keywords.ts");
  let dir: string;

  beforeAll(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "block-issue-close-keywords-")));
    writeFileSync(join(dir, "msg.txt"), "feat: x\n\nFixes #12\n");
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const run = (command: string) =>
    execFileSync("bun", [script], {
      input: JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, cwd: dir }),
      encoding: "utf8",
    });

  it("prints a deny decision with the reason", () => {
    const output = JSON.parse(run("git commit -F msg.txt")).hookSpecificOutput;
    expect(output.permissionDecision).toBe("deny");
    expect(output.permissionDecisionReason).toContain('"Fixes #12"');
  });

  it("prints nothing for a clean message", () => {
    expect(run('git commit -m "feat: x"')).toBe("");
    expect(run("ls")).toBe("");
  });

  it.each([
    ["invalid JSON", "not json"],
    ["unexpected hook input", JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Bash" })],
  ])("exits non-zero with no decision for %s", (_, input) => {
    const result = spawnSync("bun", [script], { input, encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
  });
});
