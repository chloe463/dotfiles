---
name: daily-retro
description: Run the end-of-day retrospective for a project tracked in .ai_logs. Tally PR/task status, record working time (the plan's actuals log), fill in the index entry for the day, capture learnings and rework, propose improvements (team-shared ones as a PR via the project's retrospective skill if it has one; personal ones as skills, shared rules, or memory), and list what to do next. Use when the user says things like "今日の振り返り", "本日の作業を終了します", or "振り返りを行いたい".
---

# Daily retrospective

Close out the day as the design session. Records go to the project's `.ai_logs` index (e.g. `.ai_logs/YYYY/MM/YYYYMMDD_<project>.md`) and plan (`..._project-plan.md`). If it is unclear which files to use, ask the user.

Existing plans may use Japanese section titles (e.g. 「実績の記録」 for the actuals log, 「<日付> に分かったこと (後続のタスクへの注意)」 for the learnings section). When a title already exists, match it.

## 1. Gather the state (before asking the user)

- PRs touched that day: `gh pr view <number> --json number,state,reviewDecision,headRefOid` (separate merged / awaiting review / awaiting manual testing)
- The day's entry in the index, and how the most recent rows of the plan's actuals log are written
- Running worktrees and workers (waiting? OK to clean up?)
- What was planned but not done (and why)

## 2. Show the user and ask

Present all of the following in a single message:

1. A table of **what was done today** (PR numbers and states, decisions made, what was not done)
2. **Ask for the working time** (it goes into the actuals log; never guess)
3. **Learnings and rework**: for rework, write down the root cause (e.g. treated the table in the task brief as exhaustive). Also write down what went well and what improved thanks to the user's suggestions
4. **Improvement proposals**, split in two
   - Personal (apply right after approval): personal skills (`~/.claude/skills/`), the project's common rules (e.g. `.ai_logs/.../tools/worker-common-rules.md`), memory
   - Team-shared (goes into a PR): the project's `.claude/rules`, CLAUDE.md, project skills. When creating these, follow the procedure of the project's `retrospective` skill (if it has one) and open a PR from a separate branch. For things whose mechanism isn't settled yet, proposing to postpone is fine
   - Don't over-generalize a one-off event. Check for overlap with existing rules, skills and memory first
5. Put what you want confirmed (the time, which proposals to apply, what to postpone) at the end as a numbered list

## 3. Apply what was approved

- Add one row to the plan's actuals log (date, what was done, the portion of the estimate consumed, time and person-days). At the end of a week, also add a weekly-total row and an outlook
- Add a section "Learnings from <date> (notes for follow-up tasks)" to the plan, above the previous day's section
- Write the key points of the retrospective (actuals, rules added, next steps) into the day's entry in the index
- **For anything postponed, write it as a TODO in the relevant `.ai_logs` file (design, plan or index) so it isn't forgotten**
- Update the common rules, skills and memory. Don't let memory duplicate what the rules or the repository already say (if it does, give the user a list of files to delete; the user does the deleting)

## 4. Wrap up

- Briefly list the files that were updated and what to do next (the first task of the next day)
- If any worker or worktree is left waiting, add the reason to keep it (e.g. it will be used for review fixes)
- Personal skills tracked in dotfiles are symlinks into that repository, so the skill edits from step 3 are uncommitted changes there. List those files so they get committed on a branch
