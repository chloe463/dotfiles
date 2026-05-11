#!/usr/bin/env bun

import { execFile } from "node:child_process";
import { mkdirSync, appendFileSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const LOG_DIR = `${process.env.HOME}/.claude/logs`;
const LOG_FILE = `${LOG_DIR}/${process.env.USER}-hook-notification.log`;

function writeLog(message: string) {
  const timestamp = new Date().toISOString();
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${timestamp} ${message}\n`);
  } catch {
    // log write failure is non-fatal
  }
}

const OSASCRIPT_DISPLAY_NOTIFICATION = `
  on run argv
    display notification (item 1 of argv) with title "Claude Code" subtitle (item 2 of argv) sound name (item 3 of argv)
  end run
`;

async function notifyError(message: string) {
  await execFileAsync("osascript", [
    "-e",
    OSASCRIPT_DISPLAY_NOTIFICATION,
    "--",
    message,
    "Hook Error",
    "Pop",
  ]).catch(() => {});
}

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
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    writeLog(`[error] failed to read stdin: ${msg}`);
    await notifyError(`Failed to read stdin: ${msg}`);
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    writeLog(`[error] failed to parse JSON: ${msg}`);
    await notifyError(`Failed to parse JSON: ${msg}`);
    process.exit(1);
  }

  try {
    if (mode === "stop") {
      if (!isValidStopInput(data)) {
        writeLog("[error] invalid stop input");
        process.exit(1);
      }
      await sendStopAlert(data);
    } else {
      if (!isValidNotificationInput(data)) {
        writeLog("[error] invalid notification input");
        process.exit(1);
      }
      if (isIdlePrompt(data)) return;
      await sendNotificationAlert(data);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    writeLog(`[error] failed to send notification: ${msg}`);
    await notifyError(`Failed to send notification: ${msg}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    writeLog(`[error] unexpected error: ${message}`);
    await notifyError(`Unexpected error: ${message}`);
    process.exit(1);
  });
}
