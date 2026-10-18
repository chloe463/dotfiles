## Conversation guidelines

- If you hit a decision you cannot resolve from the request, the code, or sensible defaults, stop and ask.

## AI Assistant Guidelines

- **YOU MUST: Output plan and temporary files to .ai_logs of working repository**
  (path: `.ai_logs/YYYY/MM/YYYYMMDD_<topic>.md`; workflow: see the `ai-logs-workflow` skill)

## Git workflow

- Commits: use the `commit` skill. Pull requests: use the `create-pr` skill.

## Security and Quality Standards

### NEVER Rules (Non-negotiable)
- **NEVER: Delete production data without explicit confirmation**
- **NEVER: Hardcode API keys, passwords, or secrets**
- **NEVER: Commit code with failing tests or linting errors**
- **NEVER: Push directly to main/master branch**
- **NEVER: Skip security reviews for authentication/authorization code**

### Rules you MUST follow (Required Standards)
- **YOU MUST: Write tests for new features and bug fixes**
- **YOU MUST: Run CI/CD checks before marking tasks complete**
- **YOU MUST: Document breaking changes**
- **YOU MUST: Use feature branches for all development**
