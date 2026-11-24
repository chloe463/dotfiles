import { afterEach, beforeEach, expect, it } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "create_ai_log.ts");
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "create-ai-log-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

it("does not overwrite an existing log", () => {
  const first = Bun.spawnSync(["bun", SCRIPT, "my plan"], { cwd: dir });
  expect(first.exitCode).toBe(0);

  const [year] = readdirSync(join(dir, ".ai_logs"));
  const [month] = readdirSync(join(dir, ".ai_logs", year));
  const monthDir = join(dir, ".ai_logs", year, month);
  const [file] = readdirSync(monthDir);
  expect(file).toMatch(/^\d{8}_my_plan\.md$/);
  writeFileSync(join(monthDir, file), "keep me");

  const second = Bun.spawnSync(["bun", SCRIPT, "my plan"], { cwd: dir });
  expect(second.exitCode).toBe(1);
  expect(second.stderr.toString()).toContain("already exists");
  expect(readFileSync(join(monthDir, file), "utf8")).toBe("keep me");
});
