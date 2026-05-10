#!/usr/bin/env bun

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SOUND = "Glass";

interface BaseInput {
  type: "command" | "http" | "mcp_tool" | "prompt" | "agent";
  if: string;
  timeout: number;
  statusMessage: string;
  once: boolean;
}

interface NotificationInput extends BaseInput {
  hook_event_name: "Notification";
  notification_type: string;
  message: string;
  title: string;
  session_id: string;
  transcript_path: string;
  cwd: string;
}

function isValidNotificationInput(input: unknown): input is NotificationInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }
  const obj = input as Record<string, unknown>;
  return (
    typeof obj.notification_type === "string" &&
    typeof obj.message === "string" &&
    typeof obj.title === "string"
  );
}

function isIdlePrompt(data: NotificationInput) {
  return data.notification_type === "idle_prompt";
}

async function main() {
  let input: string;
  try {
    input = await Bun.stdin.text();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`notification: failed to read stdin: ${message}\n`);
    process.stdout.write("🤖 Claude Code\n");
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`notification: JSON parse failed: ${message}\n`);
    process.exit(1);
  }

  if (!isValidNotificationInput(data)) {
    process.stderr.write(
      "notification: invalid input: missing required fields\n",
    );
    process.exit(1);
  }

  if (isIdlePrompt(data)) return;

  const script = `
    on run argv
      display notification (item 1 of argv) with title "Claude Code" subtitle (item 2 of argv)
    end run
  `;

  try {
    await Promise.all([
      execFileAsync("osascript", ["-e", script, "--", data.message, data.title]),
      execFileAsync("afplay", [`/System/Library/Sounds/${SOUND}.aiff`]),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`notification: failed to run notification: ${message}\n`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((error) => console.error(error));
}
