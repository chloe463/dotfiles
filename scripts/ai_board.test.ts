import { expect, describe, it } from 'bun:test';
import {
  classify,
  countUncheckedTestPlanItems,
  findPlanFile,
  parsePlan,
  renderPlan,
  renderPullRequests,
  type PullRequest,
} from './ai_board';

function pr(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    number: 1,
    url: 'https://github.com/o/r/pull/1',
    title: 'title',
    body: '',
    headRefName: 'feature',
    baseRefName: 'main',
    isDraft: false,
    reviewDecision: null,
    mergeable: 'MERGEABLE',
    ciState: 'SUCCESS',
    unresolvedThreads: 0,
    pendingReviewRequests: 0,
    ...overrides,
  };
}

const uncheckedBody = '## Test Plan\n\n- [ ] check it\n';

describe('countUncheckedTestPlanItems', () => {
  it('counts unchecked items in the Test Plan section only', () => {
    const body = '## Summary\n- [ ] not this\n\n## Test Plan\n\n- [x] done\n- [ ] one\n* [ ] two\n\n## Notes\n- [ ] nor this\n';
    expect(countUncheckedTestPlanItems(body)).toBe(2);
  });

  it('reads a section at the end of the body', () => {
    expect(countUncheckedTestPlanItems('## test plan\n- [ ] one')).toBe(1);
  });

  it('accepts a Japanese heading', () => {
    expect(countUncheckedTestPlanItems('## テスト手順\n- [ ] one\n')).toBe(1);
  });

  it('returns 0 without the section', () => {
    expect(countUncheckedTestPlanItems('## Summary\n- [ ] one\n')).toBe(0);
  });

  it('handles CRLF bodies from the GitHub web UI', () => {
    expect(countUncheckedTestPlanItems('## Test Plan\r\n- [ ] one\r\n- [x] two\r\n')).toBe(1);
  });
});

describe('classify', () => {
  it.each([
    ['failing CI', { ciState: 'FAILURE' }, 'ai', 'CI 失敗'],
    ['a conflict', { mergeable: 'CONFLICTING' }, 'ai', 'コンフリクト'],
    ['requested changes', { reviewDecision: 'CHANGES_REQUESTED' }, 'ai', '修正依頼'],
    ['unresolved threads', { unresolvedThreads: 2 }, 'ai', '指摘未解消 2件'],
    ['running CI', { ciState: 'PENDING' }, 'waiting', 'CI 実行中'],
    ['an unchecked test plan', { body: uncheckedBody }, 'human', '手動テスト待ち 1件'],
    ['a draft', { isDraft: true }, 'human', 'ready 待ち'],
    ['a required review', { reviewDecision: 'REVIEW_REQUIRED' }, 'waiting', 'レビュー待ち'],
    ['a requested review', { pendingReviewRequests: 1 }, 'waiting', 'レビュー待ち'],
    ['an approval', { reviewDecision: 'APPROVED' }, 'human', 'マージ可'],
    ['nothing left to do', {}, 'human', 'マージ可'],
    ['no CI at all', { ciState: null }, 'human', 'マージ可'],
  ] as [string, Partial<PullRequest>, string, string][])('classifies %s', (_name, overrides, ball, label) => {
    expect(classify(pr(overrides), 'main', [])).toEqual({ ball, label } as never);
  });

  it('shows the base PR number for a stacked PR', () => {
    const base = pr({ number: 7, headRefName: 'lower' });
    expect(classify(pr({ baseRefName: 'lower' }), 'main', [base]).label).toBe('#7 のマージ待ち');
  });

  it('shows the branch name when the base has no open PR', () => {
    expect(classify(pr({ baseRefName: 'release' }), 'main', []).label).toBe('release のマージ待ち');
  });

  it('respects the default branch name', () => {
    expect(classify(pr({ baseRefName: 'master' }), 'master', []).label).toBe('マージ可');
  });

  it('puts what the agent can fix ahead of what waits on a person', () => {
    const status = classify(pr({ ciState: 'FAILURE', body: uncheckedBody, isDraft: true }), 'main', []);
    expect(status.label).toBe('CI 失敗');
  });
});

describe('findPlanFile', () => {
  it('finds an undated plan', () => {
    expect(findPlanFile(['tasks', 'plan.md', 'notes.md'])).toBe('plan.md');
  });

  it('finds a dated plan, preferring the newest', () => {
    expect(findPlanFile(['20261101_plan.md', '20261201_plan.md', 'tasks'])).toBe('20261201_plan.md');
  });

  it('ignores other files', () => {
    expect(findPlanFile(['20261101_plan.md.bak', 'old_plan.md', '2026_plan.md'])).toBeUndefined();
  });
});

describe('parsePlan', () => {
  const plan = `# Plan

| Task | Topic | PR |
|---|---|---|
| 0-1-1 | setup | done |
| 1-1-1 | first | #10 #11 |
| 1-1-2 | second | wip |
| 1-1-3 | a | b | |
Not a table: 2-1-1
`;

  it('reads task rows and ignores everything else', () => {
    expect(parsePlan(plan).map((task) => task.id)).toEqual(['0-1-1', '1-1-1', '1-1-2', '1-1-3']);
  });

  it('reads the state from the last cell', () => {
    const [setup, first, second, third] = parsePlan(plan);
    expect(setup.done).toBe(true);
    expect(first.prNumbers).toEqual([10, 11]);
    expect(second.wip).toBe(true);
    expect(third).toMatchObject({ topic: 'a | b', prNumbers: [], done: false, wip: false });
  });
});

describe('renderPlan', () => {
  const tasks = parsePlan(`
| 1-1-1 | merged | #1 |
| 1-1-2 | half merged | #1 #2 |
| 1-1-3 | in progress | wip |
| 2-1-1 | no pr needed | done |
| 2-1-2 | next one | |
| 2-1-3 | later | |
`);

  it('counts a task as done only when all its PRs are merged', () => {
    expect(renderPlan('proj', tasks, new Set([1]))[0]).toBe('計画 proj  Phase 1: 1/3  Phase 2: 1/3');
  });

  it('lists work in progress and the first untouched task', () => {
    expect(renderPlan('proj', tasks, new Set([1])).slice(1)).toEqual(['着手中: 1-1-3', '次: 2-1-2 next one']);
  });

  it('says so when nothing is left to start', () => {
    const lines = renderPlan('proj', parsePlan('| 1-1-1 | a | done |'), new Set());
    expect(lines[lines.length - 1]).toBe('次: 未着手のタスクなし');
  });
});

describe('renderPullRequests', () => {
  it('groups by whose turn it is, with the task ID when the plan has one', () => {
    const prs = [
      pr({ number: 3, url: 'https://github.com/o/r/pull/3', reviewDecision: 'REVIEW_REQUIRED', title: 'waits' }),
      pr({ number: 2, url: 'https://github.com/o/r/pull/2', ciState: 'FAILURE', title: 'broken' }),
      pr({ number: 1, title: 'ready' }),
    ];
    const tasks = parsePlan('| 1-3-2 | topic | #1 |');
    expect(renderPullRequests(prs, 'main', tasks, 80)).toEqual([
      '▶ あなたの番 (1)',
      '  #1 1-3-2 マージ可  ready',
      '    https://github.com/o/r/pull/1',
      '▶ AI の番 (1)',
      '  #2 CI 失敗  broken',
      '    https://github.com/o/r/pull/2',
      '▶ 待ち (1)',
      '  #3 レビュー待ち  waits',
      '    https://github.com/o/r/pull/3',
    ]);
  });

  it('truncates rows to the width, counting wide characters', () => {
    const [, row] = renderPullRequests([pr({ title: 'あ'.repeat(50) })], 'main', [], 30);
    expect(Bun.stringWidth(row)).toBeLessThanOrEqual(30);
    expect(row.endsWith('…')).toBe(true);
  });

  it('never truncates the URL', () => {
    const url = 'https://github.com/owner/a-very-long-repository-name/pull/123';
    const [, , line] = renderPullRequests([pr({ url })], 'main', [], 20);
    expect(line).toBe(`    ${url}`);
  });

  it('says so when there are no PRs', () => {
    expect(renderPullRequests([], 'main', [], 80)).toEqual(['オープンな PR はありません']);
  });
});
