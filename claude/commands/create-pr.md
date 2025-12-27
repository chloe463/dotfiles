---
description: Create GitHub PR (uses create-pr Skill)
---

# Create PR Command

This command invokes the **create-pr** Skill for creating well-structured GitHub pull requests.

## Usage

- **Explicit invocation**: Run `/create-pr`
- **Automatic invocation**: Say "create a pull request" or "create a PR"

The full PR creation guidelines and workflow are defined in the create-pr Skill.

## Quick Reference

```bash
# PR Title format (Conventional Commits)
<type>[optional scope]: <subject>

# Examples
feat(auth): add OAuth2 authentication flow
fix(api): resolve race condition in user updates
refactor(db): migrate to connection pooling
```

## Prerequisites

- gh CLI installed and authenticated
- Current branch pushed to remote
- Clean commits following conventional commits format

For detailed guidelines, PR templates, examples, and best practices, the create-pr Skill will be automatically invoked.
