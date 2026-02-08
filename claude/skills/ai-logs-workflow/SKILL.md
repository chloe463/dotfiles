---
name: ai-logs-workflow
description: Manage work using .ai_logs directory for planning and task tracking. Use when the user wants to (1) resume work from an existing .ai_logs document, (2) create a new plan/design document in .ai_logs, (3) read tasks from .ai_logs, or (4) asks to "read .ai_logs/file.md and do something". Trigger on phrases like "read .ai_logs", "plan and export to .ai_logs", "check my tasks", "continue from .ai_logs", or explicit .ai_logs file references.
---

# AI Logs Workflow

Streamline work management using the `.ai_logs` directory as a persistent workspace for plans, designs, and task tracking.

## Overview

This skill automates two common workflows:

1. **Resume work**: Read existing documents from `.ai_logs`, parse tasks, and continue where you left off
2. **Plan new work**: Create structured planning documents and save them to `.ai_logs`

The `.ai_logs` directory serves as a persistent workspace that survives across Claude Code sessions, enabling continuity and better project management.

## Workflow Decision Tree

```
User request
├─ References specific .ai_logs file? (e.g., "read .ai_logs/foo.md")
│  └─ Go to: Resume Work Workflow (skip file selection)
│
├─ Asks to "check tasks", "continue work", "what's in .ai_logs"?
│  └─ Go to: Resume Work Workflow (show file selection)
│
├─ Asks to "plan X", "create design doc", "export plan to .ai_logs"?
│  └─ Go to: Plan New Work Workflow
│
└─ Mentions .ai_logs in any context?
   └─ Clarify intent, then proceed to appropriate workflow
```

## Resume Work Workflow

Use this workflow when the user wants to continue work from an existing `.ai_logs` document.

### Step 1: Select Document

If the user specified a file (e.g., "read .ai_logs/foo.md"), skip to Step 2.

Otherwise, list available `.ai_logs` files using the helper script:

```bash
ruby scripts/list_ai_logs.rb
```

Present the list to the user and ask which file to read. The script outputs files sorted by modification date (newest first).

### Step 2: Read and Parse Document

Read the selected document and identify:
- **Overview/Context**: What is this document about?
- **Tasks**: Any actionable items (flexible formats: checkboxes `- [ ]`, numbered lists, bullet points with action verbs, sections labeled "Tasks" or "TODO")
- **Status**: Which tasks are complete, in progress, or pending
- **Dependencies**: Any prerequisites or blockers mentioned

### Step 3: Present Summary

Show the user a concise summary:

```
📄 Document: .ai_logs/2026/02/20260208_api_refactoring.md
📝 Summary: [1-2 sentence overview]

Tasks found:
1. [✓] Set up database schema (completed)
2. [ ] Implement API endpoints (in progress)
3. [ ] Write integration tests (pending)
4. [ ] Update documentation (pending)

What would you like to work on?
```

### Step 4: Execute Selected Task

Wait for the user to specify which task to work on, then proceed with implementation. Update the document as work progresses.

## Plan New Work Workflow

Use this workflow when the user wants to create a new planning document in `.ai_logs`.

### Step 1: Understand the Work

Ask clarifying questions if needed:
- What is the goal or problem to solve?
- What type of work is this? (feature, refactor, bug fix, design, exploration)
- Are there specific requirements or constraints?

### Step 2: Choose Plan Structure

Based on the type of work, select an appropriate template from `references/plan_templates.md`:

- **Design Document**: For new features or architectural changes
- **Refactoring Plan**: For code improvements without functional changes
- **Bug Investigation**: For debugging and root cause analysis
- **Exploration Plan**: For research or proof-of-concept work
- **Simple Task List**: For straightforward implementation work

See `references/plan_templates.md` for complete templates.

### Step 3: Create Plan Document

Create a comprehensive plan following the selected template. Include:
- Clear problem statement and context
- Proposed solution or approach
- Implementation steps or tasks
- Testing strategy
- Success criteria

### Step 4: Export to .ai_logs

Save the document to `.ai_logs/` using the naming convention with year/month subdirectories:

```
.ai_logs/YYYY/MM/YYYYMMDD_<descriptive-topic>.md
```

Examples:
- `.ai_logs/2026/02/20260208_api_authentication.md`
- `.ai_logs/2026/02/20260208_performance_optimization.md`
- `.ai_logs/2026/01/20260115_user_dashboard_design.md`

**Important:** Create year and month directories automatically if they don't exist:
```bash
mkdir -p .ai_logs/2026/02
```

Confirm the file location to the user after creation.

## File Naming Convention

All `.ai_logs` files should follow this hierarchical format:

```
.ai_logs/YYYY/MM/YYYYMMDD_<topic>.md
```

**Directory structure:**
- **YYYY/**: Year directory (e.g., `2026/`)
- **MM/**: Month directory (e.g., `02/`, `11/`)
- **YYYYMMDD_topic.md**: Document file

**File naming:**
- **YYYYMMDD**: Date in year-month-day format (e.g., `20260208`)
- **topic**: Brief, descriptive name using lowercase and underscores (e.g., `api_refactoring`, `path_cleanup`, `feature_design`)
- **.md**: Markdown format for readability

**Benefits of hierarchical structure:**
- Better organization as projects grow
- Easier to find documents by date range
- Cleaner directory listings

## Best Practices

### Task Parsing Flexibility

Accept multiple task formats:
- Markdown checkboxes: `- [ ] Task name` or `- [x] Completed task`
- Numbered lists: `1. Task name`
- Bullet points with action verbs: `- Implement feature X`
- Section headers: `## Tasks` or `## TODO`

### Document Updates

When completing tasks from an `.ai_logs` document:
1. Update task status in the document (check boxes, add timestamps, etc.)
2. Add notes about implementation decisions or issues encountered
3. Keep the document as a historical record of the work

### Plan Document Quality

When creating new plans:
- Be specific about goals and success criteria
- Include relevant context and constraints
- Break down work into concrete, actionable tasks
- Consider testing and validation steps
- Document trade-offs and decisions made

## Resources

### scripts/list_ai_logs.rb

Ruby script to list all `.ai_logs` files in the project root, sorted by modification date (newest first). Supports both flat structure (legacy) and nested YYYY/MM/ structure.

**Usage:**
```bash
ruby scripts/list_ai_logs.rb
```

**Output format:**
```
.ai_logs/2026/02/20260208_api_refactoring.md (modified: 2026-02-08 14:30)
.ai_logs/2025/12/20251230_database_migration.md (modified: 2025-12-30 09:15)
.ai_logs/20251205_ui_redesign.md (modified: 2025-12-05 16:45)
```

### references/plan_templates.md

Collection of planning document templates for different types of work. Read this file when creating new planning documents to choose the most appropriate structure.
