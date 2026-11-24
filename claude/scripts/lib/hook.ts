// Shared entry point for the PreToolUse guards that pre-tool-use-proxy.sh runs.
// A guard only decides; this reads the hook input, logs, and prints the deny.

import { appendFileSync, mkdirSync } from "node:fs";
import { homedir, userInfo } from "node:os";

// Only the fields the Bash guards read from the hook payload
// See the full input schema https://code.claude.com/docs/ja/hooks#pretooluse-input
export interface BashToolData {
  hook_event_name: "PreToolUse";
  tool_name: "Bash";
  tool_input: { command: string };
  cwd: string;
}

export function isValidBashData(input: unknown): input is BashToolData {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }
  const obj = input as Record<string, unknown>;
  if (obj.hook_event_name !== "PreToolUse" || obj.tool_name !== "Bash") {
    return false;
  }
  if (typeof obj.cwd !== "string") return false;
  const toolInput = obj.tool_input;
  return (
    typeof toolInput === "object" &&
    toolInput !== null &&
    typeof (toolInput as Record<string, unknown>).command === "string"
  );
}

// Reads the hook input, validates it and prints a deny decision when `decide`
// returns a reason. `describe` gives the log line for a deny. Hook stderr is
// discarded, so errors go to ~/.claude/logs, and a non-zero exit tells the
// proxy that the guard couldn't evaluate the tool call.
export async function runGuard<T>(
  name: string,
  isValid: (input: unknown) => input is T,
  decide: (data: T) => string | null,
  describe: (data: T) => string,
): Promise<void> {
  const logDir = `${homedir()}/.claude/logs`;
  const writeLog = (message: string) => {
    try {
      mkdirSync(logDir, { recursive: true });
      appendFileSync(`${logDir}/${userInfo().username}-hook-${name}.log`, `${new Date().toISOString()} ${message}\n`);
    } catch {
      // Nothing else can surface the failure
    }
  };
  const fail = (message: string): never => {
    writeLog(`[error] ${message}`);
    process.exit(1);
  };
  const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

  try {
    let input: string;
    try {
      input = await Bun.stdin.text();
    } catch (error) {
      return fail(`failed to read stdin: ${errorMessage(error)}`);
    }

    let data: unknown;
    try {
      data = JSON.parse(input);
    } catch (error) {
      return fail(`failed to parse JSON: ${errorMessage(error)}`);
    }

    if (!isValid(data)) return fail("unexpected hook input");

    const reason = decide(data);
    if (!reason) return;

    writeLog(`[deny] ${describe(data)}`);
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: reason,
        },
      }),
    );
  } catch (error) {
    fail(`unexpected error: ${errorMessage(error)}`);
  }
}
