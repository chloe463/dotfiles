#!/usr/bin/env bun

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function capitalize(msg: string) {
  return msg.charAt(0).toUpperCase() + msg.substring(1);
}

interface BaseInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode:
    | "default"
    | "plan"
    | "acceptEdits"
    | "auto"
    | "dontAsk"
    | "bypassPermissions";
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  hook_event_name: string;
}

interface NotificationInput extends BaseInput {
  notification_type: string;
  message: string;
  title?: string;
}

interface StopInput extends BaseInput {
  stop_hook_active: boolean;
  last_assistant_message: string;
}

function isValidNotificationInput(input: unknown): input is NotificationInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }
  const obj = input as Record<string, unknown>;
  return (
    typeof obj.notification_type === "string" && typeof obj.message === "string"
  );
}

function isValidStopInput(input: unknown): input is StopInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }
  const obj = input as Record<string, unknown>;
  return (
    typeof obj.stop_hook_active === "boolean" &&
    typeof obj.last_assistant_message === "string"
  );
}

function isIdlePrompt(data: NotificationInput) {
  return data.notification_type === "idle_prompt";
}

const OSASCRIPT_DISPLAY_NOTIFICATION = `
  on run argv
    display notification (item 1 of argv) with title "Claude Code" subtitle (item 2 of argv) sound name (item 3 of argv)
  end run
`;

async function sendNotificationAlert(data: NotificationInput) {
  const subtitle =
    data.title || capitalize(data.notification_type.replaceAll("_", " "));
  await execFileAsync("osascript", [
    "-e",
    OSASCRIPT_DISPLAY_NOTIFICATION,
    "--",
    data.message,
    subtitle,
    "Purr",
  ]);
}

async function sendStopAlert(data: StopInput) {
  if (data.stop_hook_active) return;
  const message = data.last_assistant_message || "Task completed";
  await execFileAsync("osascript", [
    "-e",
    OSASCRIPT_DISPLAY_NOTIFICATION,
    "--",
    message,
    "Claude stopped",
    "Blow",
  ]);
}

async function main() {
  const mode = (process.argv[2] ?? "notification") as "notification" | "stop";

  let input: string;
  try {
    input = await Bun.stdin.text();
  } catch {
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch {
    process.exit(1);
  }

  try {
    if (mode === "stop") {
      if (!isValidStopInput(data)) process.exit(1);
      await sendStopAlert(data);
    } else {
      if (!isValidNotificationInput(data)) process.exit(1);
      if (isIdlePrompt(data)) return;
      await sendNotificationAlert(data);
    }
  } catch {
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`notification: unexpected error: ${message}\n`);
    process.exit(1);
  });
}
