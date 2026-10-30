import { expect, describe, it, beforeAll, afterAll } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findProtectedPush,
  isValidPreToolUseData,
  parseGitPush,
  pushDestinations,
} from "./block-push-to-main";

const onBranch = (branch: string) => () => branch;

describe("parseGitPush", () => {
  it("returns null for non-push commands", () => {
    expect(parseGitPush(["git", "status"], "/r")).toBeNull();
    expect(parseGitPush(["echo", "git", "push"], "/r")).toBeNull();
  });
  it("skips options and their values", () => {
    expect(parseGitPush(["git", "push", "-u", "--repo", "x", "origin", "HEAD"], "/r")).toEqual({
      dir: "/r",
      positionals: ["origin", "HEAD"],
    });
  });
  it("resolves git -C relative to cwd", () => {
    expect(parseGitPush(["git", "-C", "sub", "push"], "/r")?.dir).toBe("/r/sub");
  });
  it("skips env assignments and git global options", () => {
    expect(
      parseGitPush(["GIT_TRACE=1", "git", "-c", "push.default=current", "--no-pager", "push"], "/r"),
    ).toEqual({ dir: "/r", positionals: [] });
  });
});

describe("pushDestinations", () => {
  it("uses the current branch when no refspec is given", () => {
    expect(pushDestinations([], "main")).toEqual(["main"]);
    expect(pushDestinations(["origin"], "main")).toEqual(["main"]);
  });
  it("resolves HEAD and @ to the current branch", () => {
    expect(pushDestinations(["origin", "HEAD"], "main")).toEqual(["main"]);
    expect(pushDestinations(["origin", "@"], "master")).toEqual(["master"]);
  });
  it("prefers the destination side of src:dst", () => {
    expect(pushDestinations(["origin", "HEAD:feature"], "main")).toEqual(["feature"]);
    expect(pushDestinations(["origin", "feature:main"], "feature")).toEqual(["main"]);
  });
  it("strips + and refs/heads/", () => {
    expect(pushDestinations(["origin", "+refs/heads/main"], "x")).toEqual(["main"]);
  });
});

describe("findProtectedPush", () => {
  it.each([
    "git push",
    "git push origin",
    "git push -u origin HEAD",
    "git push --set-upstream origin HEAD",
    "git push origin main",
    "git add . && git commit -m x && git push",
  ])("denies %p on main", (command) => {
    expect(findProtectedPush(command, "/r", onBranch("main"))).not.toBeNull();
  });

  it("denies on master too", () => {
    expect(findProtectedPush("git push", "/r", onBranch("master"))).not.toBeNull();
  });

  it.each([
    "git push",
    "git push -u origin HEAD",
    "git push origin feature",
    "git push origin main-fix",
  ])("allows %p on a feature branch", (command) => {
    expect(findProtectedPush(command, "/r", onBranch("feature"))).toBeNull();
  });

  it("allows pushing HEAD to another branch while on main", () => {
    expect(findProtectedPush("git push origin HEAD:feature", "/r", onBranch("main"))).toBeNull();
  });

  it("allows non-push git commands on main", () => {
    expect(findProtectedPush("git status && git log", "/r", onBranch("main"))).toBeNull();
  });

  it.each([
    "git commit -F - <<'EOF'\nfix: stop running git push origin main\nEOF",
    "cat <<EOF > notes.md\ngit push\nEOF\ngit status",
    'git commit -m "$(cat <<\'EOF\'\ngit push origin main\nEOF\n)"',
  ])("ignores git push inside here-documents: %p", (command) => {
    expect(findProtectedPush(command, "/r", onBranch("main"))).toBeNull();
  });

  it("still checks commands after a here-document", () => {
    expect(findProtectedPush("cat <<EOF > a\nx\nEOF\ngit push", "/r", onBranch("main"))).not.toBeNull();
  });

  it("allows a detached HEAD", () => {
    expect(findProtectedPush("git push", "/r", onBranch(""))).toBeNull();
  });

  it("looks up the branch in the directory after cd and git -C", () => {
    const branches: Record<string, string> = { "/r": "feature", "/r/other": "main" };
    const lookup = (dir: string) => branches[dir] ?? "";
    expect(findProtectedPush("git push", "/r", lookup)).toBeNull();
    expect(findProtectedPush("cd other && git push", "/r", lookup)).not.toBeNull();
    expect(findProtectedPush("git -C other push", "/r", lookup)).not.toBeNull();
  });
});

describe("isValidPreToolUseData", () => {
  it("accepts a Bash PreToolUse payload", () => {
    expect(
      isValidPreToolUseData({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "git push" },
        cwd: "/r",
      }),
    ).toBe(true);
  });
  it("rejects other tools and malformed input", () => {
    expect(
      isValidPreToolUseData({ hook_event_name: "PreToolUse", tool_name: "Read", tool_input: {}, cwd: "/r" }),
    ).toBe(false);
    expect(isValidPreToolUseData(null)).toBe(false);
    expect(isValidPreToolUseData([])).toBe(false);
  });
});

describe("hook script", () => {
  const script = join(import.meta.dir, "block-push-to-main.ts");
  let repo: string;

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "block-push-to-main-"));
    execFileSync("git", ["init", "-q", "-b", "main", repo]);
  });
  afterAll(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  const run = (command: string) =>
    execFileSync("bun", [script], {
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command },
        cwd: repo,
      }),
      encoding: "utf8",
    });

  it("prints a deny decision for git push on main", () => {
    const output = JSON.parse(run("git push -u origin HEAD"));
    expect(output.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(output.hookSpecificOutput.permissionDecision).toBe("deny");
  });

  it("prints nothing for other commands", () => {
    expect(run("git status")).toBe("");
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
