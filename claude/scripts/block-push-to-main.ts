#!/usr/bin/env bun

// PreToolUse hook: deny `git push` whose destination is main/master.
// Static permission rules in settings.json catch `git push origin main`, but
// not pushes that implicitly target the current branch (`git push`,
// `git push -u origin HEAD`) while main/master is checked out.

import { execFileSync } from "node:child_process";
import { isValidBashData, runGuard } from "./lib/hook";
import { parseGit, resolveCommands } from "./lib/shell";

const PROTECTED_BRANCHES = ["main", "master"];

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
  const git = parseGit(words, cwd);
  if (!git || git.args[0] !== "push") return null;

  const { dir, args } = git;
  const positionals: string[] = [];
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") {
      positionals.push(...args.slice(i + 1));
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

// Returns a deny reason if `command` pushes to a protected branch, else null.
// `getCurrentBranch` returns "" outside a repository or on a detached HEAD.
export function findProtectedPush(
  command: string,
  cwd: string,
  getCurrentBranch: (dir: string) => string,
): string | null {
  for (const { words, cwd: dir } of resolveCommands(command, cwd)) {
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

if (import.meta.main) {
  await runGuard(
    "block-push-to-main",
    isValidBashData,
    ({ tool_input: { command }, cwd }) =>
      // Cheap pre-filter: this hook runs on every Bash call
      /\bgit\b/.test(command) && /\bpush\b/.test(command) ? findProtectedPush(command, cwd, currentBranchOf) : null,
    (data) => data.tool_input.command,
  );
}
