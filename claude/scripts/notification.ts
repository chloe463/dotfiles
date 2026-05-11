#!/usr/bin/env bun

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { appendFileSync } from "node:fs";

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

function isValidNotificationInput(input: unknown): input is NotificationInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }
  const obj = input as Record<string, unknown>;
  return (
    typeof obj.notification_type === "string" && typeof obj.message === "string"
  );
}

function isIdlePrompt(data: NotificationInput) {
  return data.notification_type === "idle_prompt";
}

async function main() {
  let input: string;
  try {
    input = await Bun.stdin.text();
    // appendFileSync("/tmp/claude-notification-log.txt", input + "\n", {
    //   encoding: "utf-8",
    // });
  } catch (error) {
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch (error) {
    process.exit(1);
  }

  if (!isValidNotificationInput(data)) {
    process.exit(1);
  }

  if (isIdlePrompt(data)) return;

  const script = `
    on run argv
      display notification (item 1 of argv) with title "Claude Code" subtitle (item 2 of argv) sound name "Glass"
    end run
  `;

  try {
    // argv[0]=message body, argv[1]=subtitle (title is hardcoded to "Claude Code")
    const title =
      data.title || capitalize(data.notification_type.replace("_", " "));
    await execFileAsync("osascript", ["-e", script, "--", data.message, title]);
  } catch (error) {
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
