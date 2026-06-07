---
name: brainstorming
description: Use before ANY implementation work. Refine ideas into a validated design spec through collaborative questioning. Only after design approval does implementation begin.
---

# Brainstorming Ideas Into Designs

Turn rough ideas into fully formed designs through collaborative dialogue before ANY code is written.

## Hard Gate

Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until a design has been presented and the user has approved it.

## Process

### 1. Explore Project Context
Check existing files, docs, recent changes. Understand what already exists.

### 2. Ask Clarifying Questions
One at a time. Focus on: purpose, constraints, success criteria.
Prefer multiple-choice when possible.

### 3. Propose Approaches
Offer 2-3 distinct approaches with trade-offs and your recommendation.

### 4. Present Design
Present in sections scaled to their complexity. Get approval after each section.
Cover: architecture, components, data flow, error handling, testing.

### 5. Design for Isolation
Break system into units with one clear purpose each, well-defined interfaces, independent testability.

### 6. Get Approval
User must explicitly approve the full design before you proceed.

### 7. Save Design
Write to `docs/design/YYYY-MM-DD-<topic>.md`
Commit to git.

### 8. Hand Off
Next step: invoke `writing-plans` skill to create implementation plan.

## Key Principles

- One question at a time
- Multiple choice preferred
- YAGNI ruthlessly — remove unnecessary features
- 2-3 approaches before settling
- Incremental validation per section
- Nothing is "too simple" for a design
