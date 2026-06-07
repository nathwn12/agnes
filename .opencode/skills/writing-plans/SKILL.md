---
name: writing-plans
description: Create implementation plans with bite-sized tasks. Assume implementer has zero context.
---

# Writing Plans

Scope: if design covers multiple independent subsystems, one plan per subsystem.

File structure first: map files to create/modify. One clear responsibility per file. Follow existing patterns.

Tasks: 2-5 min each. Example:
- "Write failing test" — one step
- "Implement minimal code to pass" — one step
- "Run tests, confirm pass" — one step

Template:
```
# [Feature] Plan
Goal: [1 sentence]
Architecture: [2-3 sentences]
---
### Task N: [Name]
Files: Create/Modify/Test paths
- [ ] Step 1: [action] — exact code/command
```

Self-review: all requirements mapped? no placeholders? types consistent across tasks? implementer can follow without Qs?

Next: `subagent-driven-development` skill to execute.
