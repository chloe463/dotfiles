#!/usr/bin/env bun

// PreToolUse hook: deny file edits (Edit/Write/MultiEdit/NotebookEdit) inside
// a git checkout whose current branch is main/master, so work starts on a
// feature branch before anything is changed. Git-ignored files (e.g. .ai_logs)
// and files outside any repository are left alone.

import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { runGuard } from "./lib/hook";

const PROTECTED_BRANCHES = ["main", "master"];
const EDIT_TOOLS = ["Edit", "Write", "MultiEdit", "NotebookEdit"];

// Only the fields this script actually reads from the hook payload
// See the full input schema https://code.claude.com/docs/ja/hooks#pretooluse-input
interface PreToolUseData {
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_input: { file_path?: string; notebook_path?: string };
}

export function isValidPreToolUseData(input: unknown): input is PreToolUseData {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }
  const obj = input as Record<string, unknown>;
  return (
    obj.hook_event_name === "PreToolUse" &&
    typeof obj.tool_name === "string" &&
    typeof obj.tool_input === "object" &&
    obj.tool_input !== null
  );
}

export function targetPath(data: PreToolUseData): string | null {
  if (!EDIT_TOOLS.includes(data.tool_name)) return null;
  const path = data.tool_input.file_path ?? data.tool_input.notebook_path;
  return typeof path === "string" && path !== "" ? path : null;
}

// Resolves symlinks (e.g. ~/.claude/settings.json -> dotfiles) so the branch
// is looked up in the repository the file really lives in. A file that
// doesn't exist yet is resolved through its nearest existing ancestor.
export function resolveTarget(path: string): string {
  if (existsSync(path)) return realpathSync(path);
  const parent = dirname(path);
  if (parent === path) return path;
  return join(resolveTarget(parent), basename(path));
}

export interface GitLookup {
  // "" outside a repository or on a detached HEAD
  currentBranch(dir: string): string;
  isIgnored(dir: string, path: string): boolean;
}

// Returns a deny reason if editing `path` is blocked, else null
export function findProtectedEdit(path: string, git: GitLookup): string | null {
  let dir = dirname(path);
  while (!existsSync(dir) && dirname(dir) !== dir) dir = dirname(dir);

  const branch = git.currentBranch(dir);
  if (!PROTECTED_BRANCHES.includes(branch)) return null;
  if (git.isIgnored(dir, path)) return null;

  return `Editing files on the ${branch} branch is not allowed. Create a feature branch first (e.g. \`git switch -c <type>/<topic>\`), then retry the edit.`;
}

const gitLookup: GitLookup = {
  currentBranch(dir) {
    try {
      return execFileSync("git", ["-C", dir, "branch", "--show-current"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      return "";
    }
  },
  isIgnored(dir, path) {
    try {
      execFileSync("git", ["-C", dir, "check-ignore", "-q", "--", path], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  },
};

if (import.meta.main) {
  await runGuard(
    "block-edit-on-main",
    isValidPreToolUseData,
    (data) => {
      const path = targetPath(data);
      return path ? findProtectedEdit(resolveTarget(path), gitLookup) : null;
    },
    (data) => `${data.tool_name} ${targetPath(data)}`,
  );
}
