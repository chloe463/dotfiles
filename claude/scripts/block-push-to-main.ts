#!/usr/bin/env bun

// PreToolUse hook: deny `git push` whose destination is main/master.
// Static permission rules in settings.json catch `git push origin main`, but
// not pushes that implicitly target the current branch (`git push`,
// `git push -u origin HEAD`) while main/master is checked out.

import { execFileSync } from "node:child_process";
import { mkdirSync, appendFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { resolve } from "node:path";

const LOG_DIR = `${homedir()}/.claude/logs`;
const LOG_FILE = `${LOG_DIR}/${userInfo().username}-hook-block-push-to-main.log`;

const PROTECTED_BRANCHES = ["main", "master"];

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

// Splits a shell command into simple commands (separated by ; && || | & or
// newlines), each as a list of words with quotes removed. Not a full shell
// parser: subshells, substitutions and redirections are not interpreted.
export function splitCommands(command: string): string[][] {
  const commands: string[][] = [];
  let words: string[] = [];
  let word = "";
  let inWord = false;
  let quote: "'" | '"' | null = null;

  const endWord = () => {
    if (inWord) words.push(word);
    word = "";
    inWord = false;
  };
  const endCommand = () => {
    endWord();
    if (words.length > 0) commands.push(words);
    words = [];
  };

  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === quote) {
        quote = null;
      } else if (c === "\\" && quote === '"' && i + 1 < command.length) {
        word += command[++i];
      } else {
        word += c;
      }
    } else if (c === "'" || c === '"') {
      quote = c;
      inWord = true;
    } else if (c === "\\" && i + 1 < command.length) {
      word += command[++i];
      inWord = true;
    } else if (c === ";" || c === "&" || c === "|" || c === "\n") {
      endCommand();
    } else if (c === " " || c === "\t") {
      endWord();
    } else {
      word += c;
      inWord = true;
    }
  }
  endCommand();
  return commands;
}

// git options that take their value as the next word
const GIT_GLOBAL_OPTIONS_WITH_VALUE = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--exec-path",
  "--config-env",
]);
const PUSH_OPTIONS_WITH_VALUE = new Set([
  "--repo",
  "-o",
  "--push-option",
  "--receive-pack",
  "--exec",
]);

interface PushInvocation {
  dir: string;
  // Positional arguments after `push`: [repository, ...refspecs]
  positionals: string[];
}

// Returns the push invocation if `words` is a `git push` command, resolving
// `git -C <dir>` against `cwd`.
export function parseGitPush(words: string[], cwd: string): PushInvocation | null {
  let i = 0;
  while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])) i++;
  if (words[i] !== "git") return null;
  i++;

  let dir = cwd;
  while (i < words.length && words[i].startsWith("-")) {
    const opt = words[i];
    if (GIT_GLOBAL_OPTIONS_WITH_VALUE.has(opt)) {
      if (opt === "-C" && i + 1 < words.length) dir = resolve(dir, words[i + 1]);
      i += 2;
    } else {
      i++;
    }
  }
  if (words[i] !== "push") return null;
  i++;

  const positionals: string[] = [];
  for (; i < words.length; i++) {
    const arg = words[i];
    if (arg === "--") {
      positionals.push(...words.slice(i + 1));
      break;
    }
    if (arg.startsWith("-")) {
      if (PUSH_OPTIONS_WITH_VALUE.has(arg)) i++;
      continue;
    }
    positionals.push(arg);
  }
  return { dir, positionals };
}

function stripHeadsPrefix(ref: string): string {
  return ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref;
}

// Destination branch names a push writes to. With no refspec, git pushes the
// current branch (push.default simple/current/upstream).
export function pushDestinations(positionals: string[], currentBranch: string): string[] {
  const refspecs = positionals.slice(1);
  if (refspecs.length === 0) return [currentBranch];

  return refspecs.map((refspec) => {
    const spec = refspec.startsWith("+") ? refspec.slice(1) : refspec;
    const colon = spec.indexOf(":");
    const src = colon === -1 ? spec : spec.slice(0, colon);
    const dst = colon === -1 ? "" : spec.slice(colon + 1);
    const target = dst || src;
    if (target === "HEAD" || target === "@") return currentBranch;
    return stripHeadsPrefix(target);
  });
}

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return `${homedir()}${path.slice(1)}`;
  return path;
}

// Returns a deny reason if `command` pushes to a protected branch, else null.
// `getCurrentBranch` returns "" outside a repository or on a detached HEAD.
export function findProtectedPush(
  command: string,
  cwd: string,
  getCurrentBranch: (dir: string) => string,
): string | null {
  let dir = cwd;
  for (const words of splitCommands(command)) {
    if (words[0] === "cd") {
      if (words[1]) dir = resolve(dir, expandHome(words[1]));
      continue;
    }
    const push = parseGitPush(words, dir);
    if (!push) continue;

    const currentBranch = getCurrentBranch(push.dir);
    const blocked = pushDestinations(push.positionals, currentBranch).find((branch) =>
      PROTECTED_BRANCHES.includes(branch),
    );
    if (blocked) {
      return `Pushing to ${blocked} is not allowed (current branch: ${currentBranch || "detached"}). Create a feature branch and open a pull request instead.`;
    }
  }
  return null;
}

function currentBranchOf(dir: string): string {
  try {
    return execFileSync("git", ["-C", dir, "branch", "--show-current"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

async function main() {
  let input: string;
  try {
    input = await Bun.stdin.text();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    writeLog(`[error] failed to read stdin: ${msg}`);
    process.exit(0);
  }

  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    writeLog(`[error] failed to parse JSON: ${msg}`);
    process.exit(0);
  }

  if (!isValidPreToolUseData(data)) {
    process.exit(0);
  }

  // Cheap pre-filter: this hook runs on every Bash call
  if (!/\bgit\b/.test(data.tool_input.command) || !/\bpush\b/.test(data.tool_input.command)) {
    process.exit(0);
  }

  const reason = findProtectedPush(data.tool_input.command, data.cwd, currentBranchOf);
  if (!reason) {
    process.exit(0);
  }

  writeLog(`[deny] ${data.tool_input.command}`);
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
    process.exit(0);
  });
}
