---
name: ag-feedback-receiver
description: Process code review feedback with technical evaluation, not performative agreement — verify before implementing, push back with reasoning when wrong
---

## Phase: REVIEW

Use when: Received code review feedback (from human or automated reviewer), need to evaluate and act on comments without blind acceptance.

## Core Concept

Code review feedback requires technical evaluation, not performative agreement. Verify before implementing. Ask before assuming. Push back with technical reasoning when wrong.

## The RESPONSE Pattern

### 1. READ

Read ALL feedback completely before reacting. Do not start implementing while reading.

### 2. UNDERSTAND

Restate the requirement in your own words. If unclear, ask for clarification. Never assume intent.

### 3. VERIFY

Check against codebase reality. Is the criticism technically correct? Does the codebase actually have the issue described?

### 4. EVALUATE

Is this technically sound for THIS codebase? A suggestion might be correct in theory but wrong for this project's constraints, conventions, or phase.

### 5. RESPOND

Either:
- **Technical acknowledgment**: "Fixed in abc123, added test for edge case."
- **Reasoned pushback**: "This pattern exists in 3 other places in the codebase — changing just this one would be inconsistent without a wider refactor."

### 6. IMPLEMENT

One item at a time. Test each. Commit each. Do not batch feedback items.

## Forbidden Responses

- "You're absolutely right!"
- "Great point!"
- "Excellent feedback!"

These are performative agreement. If the feedback is correct, just fix it and state what changed. If it's wrong, explain why with technical reasoning.

## Source-Specific Handling

| Source | Approach |
|--------|----------|
| **Trusted source** (human partner, senior engineer) | High confidence. Verify quickly, implement if sound. Push back only when clearly wrong. |
| **External source** (automated tool, unfamiliar reviewer) | Skeptical but fair. Verify thoroughly. Check if suggestion follows the project's established patterns. YAGNI check applies. |

## YAGNI Check

If a reviewer says "you should implement this properly" (suggesting a generalised solution), grep the codebase for actual existing usage first. If the generalized solution isn't used anywhere, push back: "YAGNI — this would be speculative generality. Happy to revisit when usage emerges."

## Graceful Correction Pattern

If you pushed back but were wrong, acknowledge cleanly: "Re-checked and you're correct — the edge case at line 42 does trigger this. Fixed in abc123."

No groveling. No excuses. Just fix.
