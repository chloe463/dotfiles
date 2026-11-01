#!/usr/bin/env bun

// PreToolUse hook: deny `git commit` and `gh pr create` whose message or body
// contains an issue-closing keyword ("Fixes #12", "closes owner/repo#3").
// Closing issues is left to the user, and runok only sees the command line,
// so this also reads the files and here-documents passed via -F/--body-file.

import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { resolve } from "node:path";
import { expandHome, parseGit, resolveCommands, splitCommands } from "./lib/shell";

const LOG_DIR = `${homedir()}/.claude/logs`;
const LOG_FILE = `${LOG_DIR}/${userInfo().username}-hook-block-issue-close-keywords.log`;

// GitHub's closing keywords followed by `#123` or `owner/repo#123`
// https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue
const CLOSING_REFERENCE = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b:?\s+(?:[\w.-]+\/[\w.-]+)?#\d+/i;

// Hook stderr is discarded, so errors go to a log file instead
function writeLog(message: string) {
  const timestamp = new Date().toISOString();
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${timestamp} ${message}\n`);
  } catch {
    // Nothing else can surface the failure
  }
}

// Only the fields this script actually reads from the hook payload
// See the full input schema https://code.claude.com/docs/ja/hooks#pretooluse-input
interface PreToolUseData {
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_input: { command: string };
  cwd: string;
}

export function isValidPreToolUseData(input: unknown): input is PreToolUseData {
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

export function findClosingReference(text: string): string | null {
  return text.match(CLOSING_REFERENCE)?.[0] ?? null;
}

type SourceKind = "text" | "file";

export interface MessageSource {
  kind: SourceKind;
  // Message text, or a file path ("-" for stdin)
  value: string;
}

interface MessageFlags {
  short: Record<string, SourceKind>;
  long: Record<string, SourceKind>;
}

const GIT_COMMIT_FLAGS: MessageFlags = {
  short: { m: "text", F: "file" },
  long: { "--message": "text", "--file": "file" },
};
const GH_PR_CREATE_FLAGS: MessageFlags = {
  short: { b: "text", F: "file" },
  long: { "--body": "text", "--body-file": "file" },
};

// Collects message flag values from `args`, handling `--flag value`,
// `--flag=value`, `-m value`, fused `-mvalue` and combined `-am value`.
export function messageSources(args: string[], flags: MessageFlags): MessageSource[] {
  const sources: MessageSource[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") break;
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      const name = eq === -1 ? arg : arg.slice(0, eq);
      const kind = flags.long[name];
      if (!kind) continue;
      const value = eq === -1 ? args[++i] : arg.slice(eq + 1);
      if (value !== undefined) sources.push({ kind, value });
    } else if (arg.startsWith("-") && arg.length > 1) {
      for (let j = 1; j < arg.length; j++) {
        const kind = flags.short[arg[j]];
        if (!kind) continue;
        const value = j + 1 < arg.length ? arg.slice(j + 1) : args[++i];
        if (value !== undefined) sources.push({ kind, value });
        break;
      }
    }
  }
  return sources;
}

interface MessageCommand {
  label: string;
  dir: string;
  sources: MessageSource[];
}

// Recognizes `git commit` and `gh pr create` and returns their message sources
export function parseMessageCommand(words: string[], cwd: string): MessageCommand | null {
  const git = parseGit(words, cwd);
  if (git) {
    if (git.args[0] !== "commit") return null;
    return { label: "commit message", dir: git.dir, sources: messageSources(git.args.slice(1), GIT_COMMIT_FLAGS) };
  }

  let i = 0;
  while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])) i++;
  if (words[i] !== "gh") return null;
  i++;
  // gh's only global flag that takes a value
  while (words[i] === "-R" || words[i] === "--repo" || words[i]?.startsWith("--repo=")) {
    i += words[i].startsWith("--repo=") ? 1 : 2;
  }
  if (words[i] !== "pr" || (words[i + 1] !== "create" && words[i + 1] !== "new")) return null;
  return { label: "pull request body", dir: cwd, sources: messageSources(words.slice(i + 2), GH_PR_CREATE_FLAGS) };
}

// Reads a message file. A missing file makes git/gh fail on their own, so it
// counts as empty; any other error propagates and the tool call is asked.
function readMessageFile(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

// Returns a deny reason if a commit message or PR body in `command` contains
// an issue-closing reference, else null.
export function findClosingCommand(
  command: string,
  cwd: string,
  readFile: (path: string) => string = readMessageFile,
): string | null {
  // stdin ("-") may be fed by a here-document on another command of the
  // pipeline, so every here-document in the input counts as stdin
  const stdin = splitCommands(command).flatMap((c) => c.heredocs);

  for (const { words, cwd: dir } of resolveCommands(command, cwd)) {
    const target = parseMessageCommand(words, dir);
    if (!target) continue;

    for (const source of target.sources) {
      const texts =
        source.kind === "text"
          ? [source.value]
          : source.value === "-"
            ? stdin
            : [readFile(resolve(target.dir, expandHome(source.value)))];
      for (const text of texts) {
        const match = findClosingReference(text);
        if (match) {
          return `The ${target.label} contains "${match}", which closes the issue when merged. Closing issues is left to the user: mention the issue without a closing keyword (e.g. "Refs #123") instead.`;
        }
      }
    }
  }
  return null;
}

async function main() {
  let input: string;
  try {
    input = await Bun.stdin.text();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    writeLog(`[error] failed to read stdin: ${msg}`);
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    writeLog(`[error] failed to parse JSON: ${msg}`);
    process.exit(1);
  }

  if (!isValidPreToolUseData(data)) {
    writeLog("[error] unexpected hook input");
    process.exit(1);
  }

  // Cheap pre-filter: this hook runs on every Bash call
  const { command } = data.tool_input;
  if (!/\b(?:commit|pr)\b/.test(command)) {
    process.exit(0);
  }

  const reason = findClosingCommand(command, data.cwd);
  if (!reason) {
    process.exit(0);
  }

  writeLog(`[deny] ${command}`);
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(output));
}

if (import.meta.main) {
  main().catch((error) => {
    const msg = error instanceof Error ? error.message : String(error);
    writeLog(`[error] unexpected error: ${msg}`);
    process.exit(1);
  });
}
