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
    case '-v':
    case '--version':
      console.log(`git-sync version ${VERSION}`);
      process.exit(0);
    default:
      die(`Unknown option: ${arg}`);
  }
}

// Determine target branch
let branch: string;
if (syncCurrentBranch) {
  branch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();
} else {
  const output = (await $`git branch -l master main`.text()).trim();
  branch = output
    .split('\n')
    .map(b => b.replace(/^[* ]+/, '').trim())
    .filter(Boolean)[0];
  if (!branch) die('git-sync: could not determine main branch (main or master)');
}

// Switch, fetch, pull
await $`git switch ${branch}`;
await $`git fetch -p origin`;
await $`git pull origin ${branch}`;

// Remove squash-merged branches if git-delete-squashed is installed
if (Bun.which('git-delete-squashed')) {
  await $`git-delete-squashed ${branch}`;
}

// Remove merged branches
let mergedBranches: string[] = [];
try {
  const output = await $`git branch --merged`.text();
  mergedBranches = output
    .split('\n')
    .filter(b => !b.includes('*'))
    .map(b => b.trim())
    .filter(b => b && b !== 'main' && b !== 'master');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`git-sync: 'git branch --merged' failed: ${message}\n`);
  process.stderr.write('Skipping merged branch cleanup.\n');
}

if (mergedBranches.length > 0) {
  try {
    await $`git branch -d ${mergedBranches}`;
  } catch {
    process.stderr.write('git-sync: some branches could not be deleted.\n');
    process.stderr.write("If a branch was squash-merged, use 'git branch -D <branch>' to force delete.\n");
  }
}