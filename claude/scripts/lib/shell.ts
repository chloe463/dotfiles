// Minimal shell parsing shared by the PreToolUse guards. Not a full shell
// parser: subshells, command substitutions and most redirections are not
// interpreted, so callers should treat the result as a best-effort view of
// the commands Claude is about to run.

import { homedir } from "node:os";
import { resolve } from "node:path";

export interface ShellCommand {
  // Words with quotes and backslashes removed
  words: string[];
  // Bodies of here-documents (<<EOF) and here-strings (<<<) attached to this
  // command. They are input data, so they never show up in `words`.
  heredocs: string[];
}

interface PendingHeredoc {
  delimiter: string;
  stripTabs: boolean;
  target: ShellCommand;
}

const OPERATOR_CHARS = new Set([";", "&", "|", "\n", "<", ">", "(", ")"]);

// Splits a shell command into simple commands (separated by ; && || | & or
// newlines). Here-document bodies are consumed after the line that opens them
// and attached to the command that declared them, instead of being parsed as
// commands of their own.
export function splitCommands(command: string): ShellCommand[] {
  const commands: ShellCommand[] = [];
  let current: ShellCommand = { words: [], heredocs: [] };
  let word = "";
  let inWord = false;
  let quote: "'" | '"' | null = null;
  let hereString = false;
  const pending: PendingHeredoc[] = [];

  const endWord = () => {
    if (inWord) {
      if (hereString) {
        current.heredocs.push(word);
        hereString = false;
      } else {
        current.words.push(word);
      }
    }
    word = "";
    inWord = false;
  };
  const endCommand = () => {
    endWord();
    if (current.words.length > 0) commands.push(current);
    current = { words: [], heredocs: [] };
  };

  // Reads a here-document delimiter starting at `start`, removing quotes
  const readDelimiter = (start: number): { delimiter: string; end: number } => {
    let i = start;
    while (command[i] === " " || command[i] === "\t") i++;
    let delimiter = "";
    let q: string | null = null;
    for (; i < command.length; i++) {
      const c = command[i];
      if (q) {
        if (c === q) q = null;
        else delimiter += c;
      } else if (c === "'" || c === '"') {
        q = c;
      } else if (c === "\\" && i + 1 < command.length) {
        delimiter += command[++i];
      } else if (c === " " || c === "\t" || OPERATOR_CHARS.has(c)) {
        break;
      } else {
        delimiter += c;
      }
    }
    return { delimiter, end: i };
  };

  // Consumes the bodies of pending here-documents, starting at the line after
  // `newline`. Returns the index of the last consumed character.
  const consumeHeredocs = (newline: number): number => {
    let pos = newline + 1;
    for (const heredoc of pending.splice(0)) {
      const lines: string[] = [];
      while (pos <= command.length) {
        const eol = command.indexOf("\n", pos);
        const lineEnd = eol === -1 ? command.length : eol;
        let line = command.slice(pos, lineEnd);
        if (heredoc.stripTabs) line = line.replace(/^\t+/, "");
        pos = lineEnd + 1;
        if (line === heredoc.delimiter) break;
        lines.push(line);
      }
      heredoc.target.heredocs.push(lines.length > 0 ? `${lines.join("\n")}\n` : "");
    }
    return pos - 1;
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
    } else if (c === "<" && command[i + 1] === "<" && command[i + 2] === "<") {
      endWord();
      hereString = true;
      i += 2;
    } else if (c === "<" && command[i + 1] === "<") {
      endWord();
      const stripTabs = command[i + 2] === "-";
      const { delimiter, end } = readDelimiter(i + (stripTabs ? 3 : 2));
      pending.push({ delimiter, stripTabs, target: current });
      i = end - 1;
    } else if (c === "\n") {
      endCommand();
      if (pending.length > 0) i = consumeHeredocs(i);
    } else if (c === ";" || c === "&" || c === "|") {
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

export function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return `${homedir()}${path.slice(1)}`;
  return path;
}

export interface ResolvedCommand extends ShellCommand {
  // Working directory the command runs in, following earlier `cd`s
  cwd: string;
}

// splitCommands, plus the working directory each command runs in. `cd`
// commands themselves are not returned.
export function resolveCommands(command: string, cwd: string): ResolvedCommand[] {
  let dir = cwd;
  const resolved: ResolvedCommand[] = [];
  for (const cmd of splitCommands(command)) {
    if (cmd.words[0] === "cd") {
      if (cmd.words[1]) dir = resolve(dir, expandHome(cmd.words[1]));
      continue;
    }
    resolved.push({ ...cmd, cwd: dir });
  }
  return resolved;
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

export interface GitInvocation {
  // Directory git operates on, resolving `git -C <dir>` against the cwd
  dir: string;
  // Subcommand and its arguments
  args: string[];
}

// Returns the git invocation if `words` runs git, skipping leading
// environment assignments and git's global options.
export function parseGit(words: string[], cwd: string): GitInvocation | null {
  let i = 0;
  while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])) i++;
  if (words[i] !== "git") return null;
  i++;

  let dir = cwd;
  while (i < words.length && words[i].startsWith("-")) {
    const opt = words[i];
    if (GIT_GLOBAL_OPTIONS_WITH_VALUE.has(opt)) {
      if (opt === "-C" && i + 1 < words.length) dir = resolve(dir, expandHome(words[i + 1]));
      i += 2;
    } else {
      i++;
    }
  }
  if (i >= words.length) return null;
  return { dir, args: words.slice(i) };
}
