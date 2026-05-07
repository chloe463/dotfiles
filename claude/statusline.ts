#!/usr/bin/env bun

import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import path from "node:path";

const DEBUG = process.env.STATUSLINE_DEBUG === "1";
const LOG_FILE = process.env.STATUSLINE_LOG_FILE ?? "/tmp/statusline.log";

function log(level: "INFO" | "ERROR", message: string): void {
  if (!DEBUG) return;
  const ts = new Date().toISOString();
  appendFileSync(LOG_FILE, `${ts} [${level}] ${message}\n`);
}

interface ContextWindow {
  context_window_size?: number;
  current_usage?: {
    input_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

interface RateLimit {
  used_percentage: number;
  resets_at: number;
}

interface StatuslineInput {
  model: { id?: string; display_name: string };
  workspace: { current_dir: string };
  context_window?: ContextWindow;
  rate_limits?: {
    five_hour?: RateLimit;
    seven_day?: RateLimit;
  };
}

function isStatuslineInput(value: unknown): value is StatuslineInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof (v.model as Record<string, unknown>)?.display_name !== "string")
    return false;
  if (typeof (v.workspace as Record<string, unknown>)?.current_dir !== "string")
    return false;
  return true;
}

function formatResetTime(resetsAt: number): string {
  const date = new Date(resetsAt * 1000);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

let input: string;
try {
  input = await Bun.stdin.text();
  log("INFO", `raw stdin: ${input}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`statusline: failed to read stdin: ${message}\n`);
  log("ERROR", `failed to read stdin: ${message}`);
  process.stdout.write("🤖 Claude Code\n");
  process.exit(1);
}

let data: unknown;
try {
  data = JSON.parse(input);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`statusline: JSON parse failed: ${message}\n`);
  log("ERROR", `JSON parse failed: ${message}`);
  process.exit(1);
}

if (!isStatuslineInput(data)) {
  process.stderr.write(
    "statusline: invalid input: missing required fields (model.display_name, workspace.current_dir)\n",
  );
  log("ERROR", `invalid input shape: ${JSON.stringify(data)}`);
  process.exit(1);
}

const isAwsBedrock = data.model.id?.startsWith("arn:") ?? false;
const modelDisplayName = isAwsBedrock
  ? data.model.display_name.startsWith("arn:")
    ? data.model.display_name
    : `${data.model.display_name} by AWS`
  : data.model.display_name;
const currentDir = path.basename(data.workspace.current_dir);

let gitBranch = "";
try {
  gitBranch = execSync("git branch --show-current", {
    cwd: data.workspace.current_dir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`statusline: git branch failed: ${message}\n`);
  log("ERROR", `git branch failed: ${message}`);
}

let contextInfo = "";
const contextSize = data.context_window?.context_window_size;
const currentUsage = data.context_window?.current_usage;
if (currentUsage && contextSize && contextSize > 0) {
  const currentTokens =
    (currentUsage.input_tokens ?? 0) +
    (currentUsage.cache_creation_input_tokens ?? 0) +
    (currentUsage.cache_read_input_tokens ?? 0);
  contextInfo = `${Math.floor((currentTokens * 100) / contextSize)}%`;
}

const elements = [`🤖 ${modelDisplayName}`, `📁 ${currentDir}`];
if (gitBranch) elements.push(` ${gitBranch}`);
if (contextInfo) elements.push(`📊 ${contextInfo}`);

if (!isAwsBedrock) {
  const fiveHour = data.rate_limits?.five_hour;
  const sevenDay = data.rate_limits?.seven_day;
  if (fiveHour) {
    elements.push(
      `5-Hour limit: ${fiveHour.used_percentage}% Reset in ${formatResetTime(fiveHour.resets_at)}`,
    );
  }
  if (sevenDay) {
    elements.push(`Weekly limit: ${sevenDay.used_percentage}%`);
  }
}

const output = elements.join(" | ");
log("INFO", `output: ${output}`);
console.log(output);
