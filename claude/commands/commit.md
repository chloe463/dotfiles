---
description: Create semantic commits (uses commit Skill)
---

# Commit Command

This command invokes the **commit** Skill for creating semantic commits following conventional commits format.

## Usage

- **Explicit invocation**: Run `/commit`
- **Automatic invocation**: Say "create a commit" or "generate a commit message"

The full commit guidelines and workflow are defined in the commit Skill.

## Quick Reference

```bash
# Conventional Commits format
<type>[optional scope]: <subject>

# Examples
feat(auth): add JWT token refresh
fix(api): handle null response in user endpoint
docs: update installation steps
```

For detailed guidelines, examples, and best practices, the commit Skill will be automatically invoked.
