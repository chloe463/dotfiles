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
function pathWith(includeRunok: boolean): string {
  const dir = join(root, includeRunok ? "path-with-runok" : "path-without-runok");
  if (!existsSync(dir)) {
    mkdirSync(dir);
    for (const tool of ["bash", "bun", "jq", "git", "cat", "dirname", "date", "id", "mkdir", "touch"]) {
      const target = execFileSync("bash", ["-c", `command -v ${tool}`], { encoding: "utf8" }).trim();
      symlinkSync(target, join(dir, tool));
    }
    if (includeRunok) symlinkSync(join(binDir, "runok"), join(dir, "runok"));
  }
  return dir;
}

function stubRunok(script: string) {
  const path = join(binDir, "runok");
  writeFileSync(path, `#!/bin/bash\ncat >/dev/null\ntouch "${runokCalled}"\n${script}\n`);
  chmodSync(path, 0o755);
  rmSync(runokCalled, { force: true });
}

function run(payload: Record<string, unknown>, { runok = true } = {}): string {
  return execFileSync("bash", [proxy], {
    input: JSON.stringify({ hook_event_name: "PreToolUse", cwd: repo, ...payload }),
    encoding: "utf8",
    env: { HOME: root, PATH: pathWith(runok) },
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
});

describe("edit tools", () => {
  it("denies edits on main", () => {
    const output = JSON.parse(run({ tool_name: "Write", tool_input: { file_path: join(repo, "a.ts") } }));
    expect(output.hookSpecificOutput.permissionDecision).toBe("deny");
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
      env: { HOME: root, PATH: pathWith(true) },
    });
    expectAsk(output, "failed to parse hook input");
  });
});
