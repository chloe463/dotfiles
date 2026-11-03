import { expect, describe, it, beforeEach, afterEach } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "log-permission-request.sh");
const user = execFileSync("id", ["-un"], { encoding: "utf8" }).trim();

let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "permission-log-"));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

function run(input: string): string {
  return execFileSync("bash", [script], {
    input,
    encoding: "utf8",
    env: { HOME: home, PATH: process.env.PATH },
  });
}

function logged(): Record<string, unknown>[] {
  return readFileSync(join(home, ".claude/logs", `${user}-permission-requests.jsonl`), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

describe("log-permission-request", () => {
  it("records the tool, command and cwd, and prints nothing", () => {
    const output = run(
      JSON.stringify({ cwd: "/repo", tool_name: "Bash", tool_input: { command: "gh pr ready 1" } }),
    );

    expect(output).toBe("");
    const [entry] = logged();
    expect(entry).toMatchObject({ cwd: "/repo", tool: "Bash", command: "gh pr ready 1" });
    expect(Number.isNaN(Date.parse(entry.time as string))).toBe(false);
  });

  it("records tools without a command", () => {
    run(JSON.stringify({ cwd: "/repo", tool_name: "WebFetch", tool_input: { url: "https://example.com" } }));

    expect(logged()[0]).toMatchObject({ tool: "WebFetch", command: null });
  });

  it("truncates long commands", () => {
    run(JSON.stringify({ tool_name: "Bash", tool_input: { command: "x".repeat(500) } }));

    expect((logged()[0].command as string).length).toBe(200);
  });

  it("exits 0 and prints nothing on invalid input", () => {
    expect(run("not json")).toBe("");
  });
});
