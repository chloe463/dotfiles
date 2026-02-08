# Planning Document Templates

Templates for different types of work in `.ai_logs`. Choose the template that best fits the work being planned.

## Design Document Template

Use for new features, architectural changes, or significant additions.

```markdown
# [Feature/Component Name]

**Date:** YYYY-MM-DD
**Status:** Planning | In Progress | Completed

## Overview

[1-2 paragraphs describing what this is and why it's needed]

## Problem Statement

[What problem does this solve? What pain points does it address?]

## Goals

- Primary goal
- Secondary goals
- Non-goals (what this explicitly does NOT address)

## Proposed Solution

### High-Level Approach

[Describe the overall approach and architecture]

### Design Decisions

| Decision | Options Considered | Choice | Rationale |
|----------|-------------------|---------|-----------|
| Example | Option A, Option B | Option A | Reason why |

### Architecture

[Diagrams, component descriptions, data flow]

## Implementation Plan

### Phase 1: [Phase Name]
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Phase 2: [Phase Name]
- [ ] Task 1
- [ ] Task 2

## Testing Strategy

- Unit tests: [What to test]
- Integration tests: [What to test]
- Manual testing: [Steps to verify]

## Success Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Risk 1 | High/Med/Low | How to mitigate |

## Future Work

[What could be done later, but not in this iteration]
```

---

## Refactoring Plan Template

Use for code improvements, restructuring, or technical debt reduction.

```markdown
# [Component/Module] Refactoring

**Date:** YYYY-MM-DD
**Status:** Planning | In Progress | Completed
**Engineer Time Saved:** ~X minutes per [occurrence/operation]

## Problem Statement

[What's messy or hard to maintain? What pain points exist?]

### Current Issues

1. Issue 1: [Description]
2. Issue 2: [Description]
3. Issue 3: [Description]

## Proposed Solution

[High-level description of the refactoring approach]

### Key Improvements

- **Improvement 1**: [Description and benefit]
- **Improvement 2**: [Description and benefit]
- **Improvement 3**: [Description and benefit]

## Implementation Plan

### Changes Required

- [ ] Change 1: [File/component to modify]
- [ ] Change 2: [File/component to modify]
- [ ] Change 3: [File/component to modify]

### Files Affected

- `path/to/file1.ext`: [What changes]
- `path/to/file2.ext`: [What changes]
- `path/to/file3.ext`: [What changes]

## Testing Strategy

- [ ] Existing tests still pass
- [ ] Behavior remains unchanged
- [ ] No regressions in [specific areas]

## Benefits

1. **Maintainability**: [How it improves]
2. **Performance**: [If applicable]
3. **Code Quality**: [How it improves]

## Risks

- **Risk**: [What could go wrong]
  - **Mitigation**: [How to prevent]

## Future Improvements

- [ ] Follow-up improvement 1
- [ ] Follow-up improvement 2
```

---

## Bug Investigation Template

Use for debugging, root cause analysis, or issue resolution.

```markdown
# [Bug/Issue Title]

**Date:** YYYY-MM-DD
**Status:** Investigating | Root Cause Found | Fixed
**Severity:** Critical | High | Medium | Low

## Symptom

[What is the observable problem? What's not working?]

## Reproduction Steps

1. Step 1
2. Step 2
3. Step 3

**Expected behavior:** [What should happen]
**Actual behavior:** [What actually happens]

## Environment

- Platform: [OS, browser, etc.]
- Version: [Software version]
- Configuration: [Relevant settings]

## Investigation Log

### [Date/Time] - Initial Investigation

[What was checked, what was found]

### [Date/Time] - Hypothesis

[Theory about what might be causing this]

### [Date/Time] - Testing

[What tests were run, results]

## Root Cause

[Once identified: What is actually causing the problem?]

## Solution

### Approach

[How to fix it]

### Implementation Tasks

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Testing

- [ ] Test case 1: [Verify fix works]
- [ ] Test case 2: [Verify no regressions]
- [ ] Test case 3: [Edge cases]

## Prevention

[How to prevent this from happening again]
```

---

## Exploration Plan Template

Use for research, proof-of-concept work, or technology evaluation.

```markdown
# [Technology/Approach] Exploration

**Date:** YYYY-MM-DD
**Status:** Planning | Exploring | Complete
**Time Budget:** [Estimated time to spend]

## Objective

[What are we trying to learn or prove?]

## Questions to Answer

1. Question 1?
2. Question 2?
3. Question 3?

## Exploration Tasks

### Phase 1: Research

- [ ] Review documentation
- [ ] Find examples/tutorials
- [ ] Check community discussions
- [ ] Identify potential issues

### Phase 2: Prototype

- [ ] Set up minimal example
- [ ] Test core functionality
- [ ] Measure performance
- [ ] Document findings

### Phase 3: Evaluation

- [ ] Compare with alternatives
- [ ] Assess pros/cons
- [ ] Consider integration effort
- [ ] Make recommendation

## Success Criteria

[How will we know if this exploration was successful?]

## Findings

[To be filled in during exploration]

### What Works Well

-

### What Doesn't Work

-

### Surprises/Gotchas

-

## Recommendation

[Final recommendation: adopt, reject, needs more investigation]

## Next Steps

- [ ] If adopted: [Implementation tasks]
- [ ] If rejected: [Alternative approaches]
```

---

## Simple Task List Template

Use for straightforward implementation work with clear requirements.

```markdown
# [Feature/Task Name]

**Date:** YYYY-MM-DD
**Status:** Not Started | In Progress | Completed

## Overview

[Brief description of what needs to be done]

## Requirements

- Requirement 1
- Requirement 2
- Requirement 3

## Tasks

- [ ] Task 1: [Description]
- [ ] Task 2: [Description]
- [ ] Task 3: [Description]
- [ ] Task 4: [Description]
- [ ] Task 5: [Description]

## Testing

- [ ] Test case 1
- [ ] Test case 2

## Done Criteria

- [ ] All tasks completed
- [ ] Tests passing
- [ ] Code reviewed
- [ ] Documentation updated
```

---

## Template Selection Guide

| Work Type | Template | Use When |
|-----------|----------|----------|
| New feature or major change | Design Document | Building something new or significant |
| Code improvement | Refactoring Plan | Cleaning up or restructuring code |
| Fixing issues | Bug Investigation | Debugging or resolving problems |
| Research or POC | Exploration Plan | Evaluating options or learning |
| Clear, simple tasks | Simple Task List | Requirements are well-understood |

## Customization Tips

- **Mix and match sections** from different templates as needed
- **Adjust detail level** based on complexity (simple features don't need full design docs)
- **Add sections** specific to your project or domain
- **Remove sections** that don't apply to the current work
- **Keep it practical** - the template should help, not create busywork
