# 🏗️ CLAUDE.md - Claude Code Global Configuration

This file provides guidance to Claude Code (claude.ai/code) when working across all projects.

## Conversation guidelines

- You can use both English and Japanese.
- If the project's CLAUDE.md doesn't specify a language, use English.
- If you are uncertain about how to complete the task, stop and ask questions.
- NEVER proceed with the task if you have any problems or doubts.

## 📚 AI Assistant Guidelines

- **YOU MUST: Output plan and temporary files to .ai_logs of working repository**
  (conventions and workflow: see the `ai-logs-workflow` skill)

## 📘 TypeScript Development

### Core Rules
- **Package Manager**: Use `yarn` > `npm` > `pnpm`
- **Type Safety**: `strict: true` in tsconfig.json
- **Null Handling**: Use optional chaining `?.` and nullish coalescing `??`
- **Imports**: Use ES modules, avoid require()
- **Tooling**: Commands differ between projects — check the project's package.json before running format/lint/typecheck/test.

## 🐚 Bash Development

### Core Rules
- **Shebang**: Always `#!/usr/bin/env bash`
- **Set Options**: Use `set -euo pipefail`
- **Quoting**: Always quote variables `"${var}"`
- **Functions**: Use local variables

## 🚫 Security and Quality Standards

### NEVER Rules (Non-negotiable)
- **NEVER: Delete production data without explicit confirmation**
- **NEVER: Hardcode API keys, passwords, or secrets**
- **NEVER: Commit code with failing tests or linting errors**
- **NEVER: Push directly to main/master branch**
- **NEVER: Skip security reviews for authentication/authorization code**
- **NEVER: Use `any` type in TypeScript production code**

### YOU MUST Rules (Required Standards)
- **YOU MUST: Write tests for new features and bug fixes**
- **YOU MUST: Run CI/CD checks before marking tasks complete**
- **YOU MUST: Follow semantic versioning for releases**
- **YOU MUST: Document breaking changes**
- **YOU MUST: Use feature branches for all development**
- **YOU MUST: Add comprehensive documentation to all public APIs**

## 🔧 Commit Standards

### Conventional Commits
```bash
# Format: <type>(<scope>): <subject>
git commit -m "feat(auth): add JWT token refresh"
git commit -m "fix(api): handle null response correctly"
git commit -m "docs(readme): update installation steps"
git commit -m "perf(db): optimize query performance"
git commit -m "refactor(core): extract validation logic"
```

### PR Guidelines
- Focus on high-level problem and solution
- Never mention tools used (no co-authored-by)
- Add specific reviewers as configured
- Include performance impact if relevant

Posting PR review comments via `gh api`: see the `gh-pr-review-comments` skill.
