#!/usr/bin/env bash
set -euo pipefail

# Sync machine branches (private/work) with main branch
# Usage: ./scripts/sync-branches.sh

echo "🔄 Syncing machine branches with main..."
echo

# Get current branch to return to it later
CURRENT_BRANCH=$(git branch --show-current)

# Ensure we're in the repo root
cd "$(git rev-parse --show-toplevel)"

# Update main
echo "→ Updating main branch..."
git checkout main
git pull origin main
echo "✅ Main branch updated"
echo

# Sync to private
echo "→ Syncing private branch..."
git checkout private
if git merge main --no-edit; then
    echo "✅ Private branch synced with main"
else
    echo "❌ Merge conflict in private branch"
    echo "💡 Resolve conflicts manually, then run:"
    echo "   git add ."
    echo "   git commit"
    echo "   git push"
    exit 1
fi
echo

# Sync to work
echo "→ Syncing work branch..."
git checkout work
if git merge main --no-edit; then
    echo "✅ Work branch synced with main"
else
    echo "❌ Merge conflict in work branch"
    echo "💡 Resolve conflicts manually, then run:"
    echo "   git add ."
    echo "   git commit"
    echo "   git push"
    exit 1
fi
echo

# Return to original branch
git checkout "$CURRENT_BRANCH"

echo "🎉 All branches synced successfully!"
echo
echo "Next steps:"
echo "  1. Review changes: git log --oneline --graph --all --decorate"
echo "  2. Push branches: git push origin private work"
