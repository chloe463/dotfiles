#!/usr/bin/env bun

// Shows who has to act next on my recent open PRs, and how far the current plan has
// progressed. Status is derived from GitHub on every run instead of being
// written down anywhere, so it can't go stale. Only the mapping from tasks to
// PRs is stored, in the plan's task table.

import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const DEFAULT_INTERVAL_SECONDS = 60;
const DEFAULT_DAYS = 7;
const PROJECT_DIR = '.ai_logs/current';

export type Ball = 'human' | 'ai' | 'waiting';

export interface PullRequest {
  number: number;
  url: string;
  title: string;
  body: string;
  headRefName: string;
  baseRefName: string;
  isDraft: boolean;
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
  ciState: string | null;
  unresolvedThreads: number;
  pendingReviewRequests: number;
}

export interface Status {
  ball: Ball;
  label: string;
}

export interface Task {
  id: string;
  topic: string;
  prNumbers: number[];
  done: boolean;
  wip: boolean;
}

export function countUncheckedTestPlanItems(body: string): number {
  const section = body.match(/^#+\s*(?:test plan|テスト).*$([\s\S]*?)(?=^#+\s|(?![\s\S]))/im);
  return section?.[1].match(/^\s*[-*] \[ \]/gm)?.length ?? 0;
}

// The first match wins, so anything the agent can fix comes before anything
// that waits on a person.
export function classify(pr: PullRequest, defaultBranch: string, openPrs: PullRequest[]): Status {
  if (pr.ciState === 'FAILURE' || pr.ciState === 'ERROR') return { ball: 'ai', label: 'CI 失敗' };
  if (pr.mergeable === 'CONFLICTING') return { ball: 'ai', label: 'コンフリクト' };
  if (pr.reviewDecision === 'CHANGES_REQUESTED') return { ball: 'ai', label: '修正依頼' };
  if (pr.unresolvedThreads > 0) return { ball: 'ai', label: `指摘未解消 ${pr.unresolvedThreads}件` };
  if (pr.ciState === 'PENDING' || pr.ciState === 'EXPECTED') return { ball: 'waiting', label: 'CI 実行中' };
  if (pr.baseRefName !== defaultBranch) {
    const base = openPrs.find((other) => other.headRefName === pr.baseRefName);
    return { ball: 'waiting', label: `${base ? `#${base.number}` : pr.baseRefName} のマージ待ち` };
  }
  const unchecked = countUncheckedTestPlanItems(pr.body);
  if (unchecked > 0) return { ball: 'human', label: `手動テスト待ち ${unchecked}件` };
  if (pr.isDraft) return { ball: 'human', label: 'ready 待ち' };
  if (pr.reviewDecision === 'REVIEW_REQUIRED' || pr.pendingReviewRequests > 0) {
    return { ball: 'waiting', label: 'レビュー待ち' };
  }
  return { ball: 'human', label: 'マージ可' };
}

// The plan is `plan.md` or `YYYYMMDD_plan.md`. The newest dated one wins, and
// `plan.md` sorts after any date.
export function findPlanFile(fileNames: string[]): string | undefined {
  return fileNames.filter((name) => /^(\d{8}_)?plan\.md$/.test(name)).sort().at(-1);
}

// Task rows look like `| 1-3-2 | topic | #123 |`. The last cell holds the PR
// numbers, or `done` / `wip` for a task without a PR.
export function parsePlan(markdown: string): Task[] {
  const tasks: Task[] = [];
  for (const line of markdown.split('\n')) {
    const cells = line.trim().match(/^\|(.*)\|$/)?.[1].split('|').map((cell) => cell.trim());
    if (!cells || cells.length < 2 || !/^\d+(-\d+)+$/.test(cells[0])) continue;
    const state = cells[cells.length - 1];
    tasks.push({
      id: cells[0],
      topic: cells.length > 2 ? cells.slice(1, -1).join(' | ') : '',
      prNumbers: [...state.matchAll(/#(\d+)/g)].map((match) => Number(match[1])),
      done: /^done$/i.test(state),
      wip: /^wip$/i.test(state),
    });
  }
  return tasks;
}

function isDone(task: Task, merged: Set<number>): boolean {
  return task.done || (task.prNumbers.length > 0 && task.prNumbers.every((number) => merged.has(number)));
}

export function renderPlan(project: string, tasks: Task[], merged: Set<number>): string[] {
  const phases = new Map<string, { done: number; total: number }>();
  for (const task of tasks) {
    const phase = task.id.split('-')[0];
    const counts = phases.get(phase) ?? { done: 0, total: 0 };
    counts.total += 1;
    if (isDone(task, merged)) counts.done += 1;
    phases.set(phase, counts);
  }
  const progress = [...phases].map(([phase, { done, total }]) => `Phase ${phase}: ${done}/${total}`).join('  ');
  const lines = [`計画 ${project}  ${progress}`];
  const wip = tasks.filter((task) => task.wip && !isDone(task, merged));
  if (wip.length > 0) lines.push(`着手中: ${wip.map((task) => task.id).join(', ')}`);
  const next = tasks.find((task) => !isDone(task, merged) && !task.wip && task.prNumbers.length === 0);
  lines.push(next ? `次: ${next.id} ${next.topic}`.trimEnd() : '次: 未着手のタスクなし');
  return lines;
}

const GROUPS: { ball: Ball; heading: string }[] = [
  { ball: 'human', heading: 'あなたの番' },
  { ball: 'ai', heading: 'AI の番' },
  { ball: 'waiting', heading: '待ち' },
];

function truncate(text: string, width: number): string {
  if (Bun.stringWidth(text) <= width) return text;
  let result = '';
  for (const char of text) {
    if (Bun.stringWidth(`${result}${char}…`) > width) break;
    result += char;
  }
  return `${result}…`;
}

export function renderPullRequests(
  prs: PullRequest[],
  defaultBranch: string,
  tasks: Task[],
  width: number,
): string[] {
  if (prs.length === 0) return ['オープンな PR はありません'];
  const lines: string[] = [];
  for (const { ball, heading } of GROUPS) {
    const rows = prs
      .map((pr) => ({ pr, status: classify(pr, defaultBranch, prs) }))
      .filter(({ status }) => status.ball === ball);
    if (rows.length === 0) continue;
    lines.push(`▶ ${heading} (${rows.length})`);
    for (const { pr, status } of rows) {
      const task = tasks.find((candidate) => candidate.prNumbers.includes(pr.number));
      const row = `  #${pr.number} ${task ? `${task.id} ` : ''}${status.label}  ${pr.title}`;
      lines.push(truncate(row, width));
      // On its own line and never truncated, so the terminal can open it.
      lines.push(`    ${pr.url}`);
    }
  }
  return lines;
}

function gh(args: string[]): string {
  const result = Bun.spawnSync(['gh', ...args], { stderr: 'pipe' });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim() || `gh ${args[0]} failed`);
  return result.stdout.toString();
}

function graphql<T>(query: string): T {
  return JSON.parse(gh(['api', 'graphql', '-f', `query=${query}`])).data as T;
}

const PULL_REQUEST_FIELDS = `
  number url title body headRefName baseRefName isDraft reviewDecision mergeable state
  reviewRequests { totalCount }
  reviewThreads(first: 100) { nodes { isResolved } }
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
`;

interface PullRequestNode extends Omit<PullRequest, 'ciState' | 'unresolvedThreads' | 'pendingReviewRequests'> {
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  reviewRequests: { totalCount: number };
  reviewThreads: { nodes: { isResolved: boolean }[] };
  commits: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] };
}

function toPullRequest(node: PullRequestNode): PullRequest {
  return {
    number: node.number,
    url: node.url,
    title: node.title,
    body: node.body,
    headRefName: node.headRefName,
    baseRefName: node.baseRefName,
    isDraft: node.isDraft,
    reviewDecision: node.reviewDecision,
    mergeable: node.mergeable,
    ciState: node.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null,
    unresolvedThreads: node.reviewThreads.nodes.filter((thread) => !thread.isResolved).length,
    pendingReviewRequests: node.reviewRequests.totalCount,
  };
}

// The date `days` days before `now`, as GitHub search's `created:>=` takes it.
export function sinceDate(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function searchQuery(owner: string, name: string, since: string): string {
  return `repo:${owner}/${name} is:pr is:open author:@me created:>=${since} sort:updated-desc`;
}

// Searching rather than listing the repository's PRs lets GitHub filter by
// author and age, so other people's PRs can't push mine out of the first 100.
function fetchPullRequests(owner: string, name: string, since: string): { defaultBranch: string; prs: PullRequest[] } {
  const data = graphql<{
    repository: { defaultBranchRef: { name: string } };
    search: { nodes: PullRequestNode[] };
  }>(`query {
    repository(owner: "${owner}", name: "${name}") { defaultBranchRef { name } }
    search(type: ISSUE, first: 100, query: "${searchQuery(owner, name, since)}") {
      nodes { ... on PullRequest { ${PULL_REQUEST_FIELDS} } }
    }
  }`);
  return {
    defaultBranch: data.repository.defaultBranchRef.name,
    prs: data.search.nodes.map(toPullRequest),
  };
}

// PRs the plan names but the search didn't return: merged ones count towards
// progress, and open ones are older than the window but still part of the
// current work, so they go on the board too.
function fetchPlanPullRequests(
  owner: string,
  name: string,
  numbers: number[],
): { merged: Set<number>; open: PullRequest[] } {
  if (numbers.length === 0) return { merged: new Set(), open: [] };
  const fields = numbers
    .map((number) => `pr${number}: pullRequest(number: ${number}) { ${PULL_REQUEST_FIELDS} }`)
    .join(' ');
  const data = graphql<{ repository: Record<string, PullRequestNode | null> }>(
    `query { repository(owner: "${owner}", name: "${name}") { ${fields} } }`,
  );
  const nodes = Object.values(data.repository).filter((node): node is PullRequestNode => node !== null);
  return {
    merged: new Set(nodes.filter((node) => node.state === 'MERGED').map((node) => node.number)),
    open: nodes.filter((node) => node.state === 'OPEN').map(toPullRequest),
  };
}

// `.ai_logs` lives in the main checkout, so resolve it from a worktree too.
function mainCheckout(): string {
  const result = Bun.spawnSync(['git', 'rev-parse', '--git-common-dir'], { stderr: 'pipe' });
  if (result.exitCode !== 0) throw new Error('not inside a git repository');
  return dirname(resolve(result.stdout.toString().trim()));
}

function render(width: number, days: number): string {
  const { owner, name } = JSON.parse(gh(['repo', 'view', '--json', 'owner,name'])) as {
    owner: { login: string };
    name: string;
  };
  const { defaultBranch, prs: recent } = fetchPullRequests(owner.login, name, sinceDate(new Date(), days));

  const projectDir = join(mainCheckout(), PROJECT_DIR);
  const planFile = existsSync(projectDir) ? findPlanFile(readdirSync(projectDir)) : undefined;
  const tasks = planFile ? parsePlan(readFileSync(join(projectDir, planFile), 'utf8')) : [];
  const found = new Set(recent.map((pr) => pr.number));
  const others = [...new Set(tasks.flatMap((task) => task.prNumbers))].filter((number) => !found.has(number));
  const { merged, open } = fetchPlanPullRequests(owner.login, name, others);
  const prs = [...recent, ...open];

  const lines = renderPullRequests(prs, defaultBranch, tasks, width);
  if (planFile) {
    lines.push('', ...renderPlan(basename(realpathSync(projectDir)), tasks, merged));
  }
  return lines.join('\n');
}

export interface Options {
  days: number;
  watch?: number;
}

function positive(value: string | undefined, what: string): number {
  const number = Number(value);
  if (value === undefined || !Number.isFinite(number) || number <= 0) throw new Error(`invalid ${what}: ${value}`);
  return number;
}

export function parseArgs(args: string[]): Options {
  const options: Options = { days: DEFAULT_DAYS };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--watch' || arg === '-w') {
      // The interval is optional, so only take the next argument if it isn't a flag.
      const next = args[i + 1];
      options.watch = next !== undefined && !next.startsWith('-') ? positive(args[++i], 'interval') : DEFAULT_INTERVAL_SECONDS;
    } else if (arg === '--days' || arg === '-d') {
      options.days = positive(args[++i], 'days');
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

function usage(): never {
  console.log(`ai-board - Show who has to act next on your open PRs and the current plan's progress.
Usage:
    ai-board [--days days] [--watch [seconds]]
Options:
    --days, -d      show PRs created in the last ${DEFAULT_DAYS} days, or the given number of days
    --watch, -w     redraw every ${DEFAULT_INTERVAL_SECONDS} seconds, or the given number of seconds
    --help, -h      print this
Open PRs the plan names are shown however old they are.
The plan is read from plan.md or YYYYMMDD_plan.md in ${PROJECT_DIR} in the main checkout.`);
  process.exit(0);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) usage();
  let options: Options;
  try {
    options = parseArgs(args);
  } catch (error) {
    console.error(`ai-board: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  if (options.watch === undefined) {
    try {
      console.log(render(process.stdout.columns ?? 120, options.days));
    } catch (error) {
      console.error(`ai-board: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
    return;
  }

  // Keep the last good board when a fetch fails, so a network blip in a
  // long-lived pane doesn't hide everything.
  let board = '';
  while (true) {
    let error = '';
    try {
      board = render(process.stdout.columns ?? 120, options.days);
    } catch (caught) {
      error = `\n\n更新失敗: ${caught instanceof Error ? caught.message : String(caught)}`;
    }
    const time = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    process.stdout.write(`\x1b[2J\x1b[H${board}${error}\n\n${time} 更新`);
    await Bun.sleep(options.watch * 1000);
  }
}

if (import.meta.main) await main();
