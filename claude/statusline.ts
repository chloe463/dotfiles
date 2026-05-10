#!/usr/bin/env bun

import { format } from "node:util";
import { execSync } from "node:child_process";
import path from "node:path";

import chalk from "chalk";

// NOTE: Set level 3 to affect colors in the statusline.
chalk.level = 3;

function renderClaudeBrandColor(msg: string) {
  return chalk.hex("#DE7356")(msg);
}

function renderRatio(msg: string, ratio: number) {
  if (ratio < 50) return chalk.hex("cccccc")(format(msg, ratio));
  if (ratio < 75) return chalk.yellow(format(msg, ratio));
  return chalk.red(format(msg, ratio));
}

function renderSubText(msg: string) {
  return chalk.hex("9c9c9c")(msg);
}

function renderDivider(msg: string) {
  return chalk.hex("5c5c5c")(msg);
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

export function isRateLimit(v: unknown): v is RateLimit {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.used_percentage === "number" &&
    typeof r.resets_at === "number" &&
    Number.isFinite(r.resets_at)
  );
}

export function isStatuslineInput(value: unknown): value is StatuslineInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof (v.model as Record<string, unknown>)?.display_name !== "string")
    return false;
  if (typeof (v.workspace as Record<string, unknown>)?.current_dir !== "string")
    return false;
  const rl = v.rate_limits;
  if (rl !== undefined && typeof rl === "object" && rl !== null) {
    const rateLimits = rl as Record<string, unknown>;
    if (
      rateLimits.five_hour !== undefined &&
      !isRateLimit(rateLimits.five_hour)
    )
      return false;
    if (
      rateLimits.seven_day !== undefined &&
      !isRateLimit(rateLimits.seven_day)
    )
      return false;
  }
  return true;
}

export function formatResetTime(resetsAt: number): string {
  if (!Number.isFinite(resetsAt) || resetsAt <= 0) return "??:??";
  const date = new Date(resetsAt * 1000);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function extractModelName(model: StatuslineInput["model"]): string {
  if (!(model.id?.startsWith("arn:") ?? false)) return model.display_name;
  return model.display_name.startsWith("arn:")
    ? `${model.display_name.split("/").pop() ?? model.display_name} by AWS`
    : `${model.display_name} by AWS`;
}

function extractCurrentDir(workspace: StatuslineInput["workspace"]): string {
  return path.basename(workspace.current_dir);
}

function getBranchName(cwd: string): string {
  try {
    return execSync("git branch --show-current", {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`statusline: git branch failed: ${message}\n`);
    return "";
  }
}

function calcContextUsage(contextWindow: ContextWindow | undefined): number {
  const contextSize = contextWindow?.context_window_size;
  const currentUsage = contextWindow?.current_usage;
  if (!currentUsage || !contextSize || contextSize <= 0) return 0;
  const currentTokens =
    (currentUsage.input_tokens ?? 0) +
    (currentUsage.cache_creation_input_tokens ?? 0) +
    (currentUsage.cache_read_input_tokens ?? 0);
  return Math.floor((currentTokens * 100) / contextSize);
}

async function main() {
  let input: string;
  try {
    input = await Bun.stdin.text();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`statusline: failed to read stdin: ${message}\n`);
    process.stdout.write("🤖 Claude Code\n");
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`statusline: JSON parse failed: ${message}\n`);
    process.exit(1);
  }

  if (!isStatuslineInput(data)) {
    process.stderr.write(
      "statusline: invalid input: missing required fields (model.display_name, workspace.current_dir)\n",
    );
    process.exit(1);
  }

  const isAwsBedrock = data.model.id?.startsWith("arn:") ?? false;
  const modelDisplayName = extractModelName(data.model);
  const currentDir = extractCurrentDir(data.workspace);
  const gitBranch = getBranchName(data.workspace.current_dir);
  const contextInfo = calcContextUsage(data.context_window);

  const elements = [
    renderClaudeBrandColor(` ${modelDisplayName}`),
    renderSubText(` ${currentDir}`),
  ];
  if (gitBranch) elements.push(renderSubText(` ${gitBranch}`));
  if (contextInfo) elements.push(renderRatio(`󰺑 %d\%`, contextInfo));

  const limitations: string[] = [];
  if (!isAwsBedrock) {
    const fiveHour = data.rate_limits?.five_hour;
    const sevenDay = data.rate_limits?.seven_day;
    if (fiveHour) {
      limitations.push(
        renderRatio(
          `󱦟 5h: %d\% (Reset at ${formatResetTime(fiveHour.resets_at)})`,
          Math.floor(fiveHour.used_percentage),
        ),
      );
    }
    if (sevenDay) {
      limitations.push(
        renderRatio(`󰃰 7d: %d\%`, Math.floor(sevenDay.used_percentage)),
      );
    }
  }

  const divider = renderDivider(" | ");
  const output = elements.join(divider);
  const limitationOutput = limitations.join(divider);
  console.log(output);
  if (limitations.length > 0) console.log(limitationOutput);
}

if (import.meta.main) {
  main();
}
