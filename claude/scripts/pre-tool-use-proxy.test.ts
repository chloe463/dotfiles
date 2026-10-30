import { expect, describe, it, beforeAll, afterAll } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// Runs the real proxy with a stub `runok` on PATH, so the routing and the
// handling of runok's output can be checked without runok installed.

const proxy = join(import.meta.dir, "pre-tool-use-proxy.sh");

let root: string;
let repo: string;
let binDir: string;
let runokCalled: string;
let runokConfig: string;

// PATH containing the tools the proxy needs, plus the runok stub in binDir.
// Built from symlinks so a runok installed on the machine isn't picked up.
function pathWith({ runok = true, bun = true, jq = true } = {}): string {
  const dir = join(root, `path-runok-${runok}-bun-${bun}-jq-${jq}`);
  if (!existsSync(dir)) {
    mkdirSync(dir);
    const tools = ["bash", "git", "cat", "dirname", "date", "id", "mkdir", "touch"];
    if (bun) tools.push("bun");
    if (jq) tools.push("jq");
    for (const tool of tools) {
      const target = execFileSync("bash", ["-c", `command -v ${tool}`], { encoding: "utf8" }).trim();
      symlinkSync(target, join(dir, tool));
    }
    if (runok) symlinkSync(join(binDir, "runok"), join(dir, "runok"));
  }
  return dir;
}

function stubRunok(script: string) {
  const path = join(binDir, "runok");
  writeFileSync(path, `#!/bin/bash\ncat >/dev/null\ntouch "${runokCalled}"\n${script}\n`);
  chmodSync(path, 0o755);
  rmSync(runokCalled, { force: true });
}

function run(payload: Record<string, unknown>, tools: Parameters<typeof pathWith>[0] = {}): string {
  return execFileSync("bash", [proxy], {
    input: JSON.stringify({ hook_event_name: "PreToolUse", cwd: repo, ...payload }),
    encoding: "utf8",
    env: { HOME: root, PATH: pathWith(tools) },
  });
}

const bash = (command: string) => ({ tool_name: "Bash", tool_input: { command } });

function expectAsk(stdout: string, reason: string) {
  const output = JSON.parse(stdout).hookSpecificOutput;
  expect(output.permissionDecision).toBe("ask");
  expect(output.permissionDecisionReason).toContain(reason);
}

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "pre-tool-use-proxy-")));
  repo = join(root, "repo");
  binDir = join(root, "bin");
  runokCalled = join(root, "runok-called");
  runokConfig = join(root, ".config", "runok", "runok.yml");
  mkdirSync(binDir);
  mkdirSync(dirname(runokConfig), { recursive: true });
  writeFileSync(runokConfig, "");
  execFileSync("git", ["init", "-q", "-b", "main", repo]);
});
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("Bash", () => {
  it("denies an implicit push to main without consulting runok", () => {
    stubRunok(`echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'`);
    const output = JSON.parse(run(bash("git push -u origin HEAD")));
    expect(output.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(existsSync(runokCalled)).toBe(false);
  });

  it("passes runok's decision through", () => {
    stubRunok(`echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask"}}'`);
    const output = JSON.parse(run(bash("curl https://example.com")));
    expect(output.hookSpecificOutput.permissionDecision).toBe("ask");
  });

  it("prints nothing when runok passes", () => {
    stubRunok("true");
    expect(run(bash("make build"))).toBe("");
    expect(existsSync(runokCalled)).toBe(true);
  });

  it("asks when runok fails, even if it printed a decision", () => {
    stubRunok(`echo '{"hookSpecificOutput":{"permissionDecision":"allow"}}'; exit 1`);
    expectAsk(run(bash("ls")), "runok hook exited with 1");
  });

  it("asks when runok prints non-JSON", () => {
    stubRunok("echo garbage");
    expectAsk(run(bash("ls")), "non-JSON");
  });

  it("asks when runok is not installed", () => {
    expectAsk(run(bash("ls"), { runok: false }), "runok not found");
  });

  it("asks without consulting runok when the config is missing", () => {
    stubRunok("true");
    rmSync(runokConfig);
    try {
      expectAsk(run(bash("ls")), "runok config not found");
      expect(existsSync(runokCalled)).toBe(false);
    } finally {
      writeFileSync(runokConfig, "");
    }
  });

  it("still denies an implicit push to main when runok is not installed", () => {
    const output = JSON.parse(run(bash("git push -u origin HEAD"), { runok: false }));
    expect(output.hookSpecificOutput.permissionDecision).toBe("deny");
  });

  it("asks without consulting runok when the push guard fails", () => {
    stubRunok(`echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'`);
    expectAsk(run({ ...bash("git push"), cwd: 1 }), "block-push-to-main exited with 1");
    expect(existsSync(runokCalled)).toBe(false);
  });

  it("asks when bun is not installed", () => {
    expectAsk(run(bash("git push"), { bun: false }), "block-push-to-main exited with 127");
  });

  it("asks with valid JSON when jq is not installed", () => {
    stubRunok(`echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'`);
    expectAsk(run(bash("ls"), { jq: false }), "failed to parse hook input");
    expect(existsSync(runokCalled)).toBe(false);
  });
});

describe("edit tools", () => {
  const write = { tool_name: "Write", tool_input: { file_path: "/tmp/a.ts" } };

  it("denies edits on main", () => {
    const output = JSON.parse(run({ tool_name: "Write", tool_input: { file_path: join(repo, "a.ts") } }));
    expect(output.hookSpecificOutput.permissionDecision).toBe("deny");
  });

  it("asks when the edit guard fails", () => {
    expectAsk(run({ ...write, hook_event_name: "Other" }), "block-edit-on-main exited with 1");
  });

  it("asks when bun is not installed", () => {
    expectAsk(run(write, { bun: false }), "block-edit-on-main exited with 127");
  });
});

describe("other tools", () => {
  it("prints nothing", () => {
    stubRunok(`echo '{"hookSpecificOutput":{"permissionDecision":"deny"}}'`);
    expect(run({ tool_name: "Read", tool_input: { file_path: join(repo, "a.ts") } })).toBe("");
    expect(existsSync(runokCalled)).toBe(false);
  });
});

describe("invalid hook input", () => {
  it("asks", () => {
    const output = execFileSync("bash", [proxy], {
      input: "not json",
      encoding: "utf8",
      env: { HOME: root, PATH: pathWith() },
    });
    expectAsk(output, "failed to parse hook input");
  });
});
