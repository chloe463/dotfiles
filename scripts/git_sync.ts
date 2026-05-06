#!/usr/bin/env bun

import { $ } from 'bun';

const VERSION = '0.2.0';

function usage(): never {
  console.log(
    `git-sync - Synchronize main/master branch with the remote.
Usage:
    git sync [-c]
Options:
    --current, -c     synchronize current branch with the remote
    --version, -v     print version
    --help, -h        print this`
  );
  process.exit(0);
}

function die(msg: string, code = 1): never {
  process.stderr.write(`${msg}\n`);
  process.exit(code);
}

// Extract the actual git error output from Bun's ShellError
function stderrOf(error: unknown): string {
  if (error instanceof Error && 'stderr' in error) {
    const raw = new TextDecoder().decode(error.stderr as Uint8Array).trim();
    if (raw) return raw;
  }
  return error instanceof Error ? error.message : String(error);
}

let syncCurrentBranch = false;
for (const arg of process.argv.slice(2)) {
  switch (arg) {
    case '-c':
    case '--current':
      syncCurrentBranch = true;
      break;
    case '-h':
    case '--help':
      usage();
      break;
    case '-v':
    case '--version':
      console.log(`git-sync version ${VERSION}`);
      process.exit(0);
      break;
    default:
      die(`Unknown option: ${arg}`);
  }
}

// Determine target branch
let branch: string;
if (syncCurrentBranch) {
  let output: string;
  try {
    output = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();
  } catch (error) {
    die(`git-sync: failed to determine current branch: ${stderrOf(error)}`);
  }
  if (output === 'HEAD') {
    die('git-sync: cannot sync in detached HEAD state. Check out a branch first.');
  }
  branch = output;
} else {
  let output: string;
  try {
    output = (await $`git branch -l master main`.text()).trim();
  } catch (error) {
    die(`git-sync: failed to list branches: ${stderrOf(error)}`);
  }
  const branches = output
    .split('\n')
    .map(b => b.replace(/^[* ]+/, '').trim())
    .filter(Boolean);
  if (branches.length === 0) {
    die('git-sync: could not determine main branch (main or master)');
  }
  if (branches.length > 1) {
    die("git-sync: both main and master exist; cannot determine default branch. Delete one, or run 'git sync -c' to sync your current branch.");
  }
  branch = branches[0];
}

// Switch, fetch, pull
try {
  await $`git switch ${branch}`;
} catch (error) {
  die(`git-sync: 'git switch ${branch}' failed: ${stderrOf(error)}`);
}

try {
  await $`git fetch -p origin`;
} catch (error) {
  die(`git-sync: 'git fetch' failed: ${stderrOf(error)}`);
}

try {
  await $`git pull origin ${branch}`;
} catch (error) {
  die(`git-sync: 'git pull' failed: ${stderrOf(error)}`);
}

// Remove squash-merged branches if git-delete-squashed is installed
let hasError = false;
if (Bun.which('git-delete-squashed') !== null) {
  try {
    await $`git-delete-squashed ${branch}`;
  } catch (error) {
    process.stderr.write(`git-sync: 'git-delete-squashed' failed (continuing): ${stderrOf(error)}\n`);
    hasError = true;
  }
}

// Remove merged branches
let mergedBranches: string[] = [];
try {
  const output = await $`git branch --merged`.text();
  mergedBranches = output
    .split('\n')
    .filter(b => !b.includes('*'))
    .map(b => b.replace(/^[+* ]+/, '').trim())
    .filter(b => b && b !== 'main' && b !== 'master');
} catch (error) {
  process.stderr.write(`git-sync: 'git branch --merged' failed: ${stderrOf(error)}\n`);
  process.stderr.write('Skipping merged branch cleanup.\n');
  hasError = true;
}

if (mergedBranches.length > 0) {
  try {
    await $`git branch -d ${mergedBranches}`;
  } catch (error) {
    process.stderr.write(`git-sync: 'git branch -d' failed: ${stderrOf(error)}\n`);
    process.stderr.write("If a branch was squash-merged, use 'git branch -D <branch>' to force delete.\n");
    hasError = true;
  }
}

if (hasError) process.exit(1);
