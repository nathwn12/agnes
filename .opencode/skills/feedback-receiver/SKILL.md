---
id: feedback-receiver
name: feedback-receiver
description: 'Received code review feedback (from human or automated reviewer), need to evaluate and act on comments without blind acceptance.'
phase: "REVIEW"
use_when: "Received code review feedback (from human or automated reviewer), needing to evaluate or merge external review feedback and act on comments without blind acceptance."
version: 1.2
---

## Use When

Received code review feedback (from human or automated reviewer), need to evaluate and act on comments without blind acceptance.

## Core Concept

Code review feedback requires technical evaluation, not performative agreement. Verify before implementing. Ask before assuming. Push back with technical reasoning when wrong.

**Core principle:** Technical correctness over social comfort. Actions speak louder than words. The code itself shows you heard the feedback.

## Precise Vocabulary

- **Performative agreement**: Agreeing with feedback without technical evaluation
- **Technical acknowledgment**: Confirming a fix with specific evidence (commit hash, what changed)
- **Reasoned pushback**: Disagreeing with technical reasoning backed by codebase evidence
- **YAGNI**: You Ain't Gonna Need It — rejecting speculative generalization
- **Graceful correction**: Admitting error cleanly when pushback was wrong

## Context Requirements

The approach depends on the source of feedback:

| Source | Approach |
|--------|----------|
| **Trusted source** (human partner, senior engineer) | High confidence. Verify quickly, implement if sound. Push back only when clearly wrong. |
| **External source** (automated tool, unfamiliar reviewer) | Skeptical but fair. Verify thoroughly. Check if suggestion follows the project's established patterns. YAGNI check applies. |

Regardless of source, never implement partially understood feedback. If any item is unclear, stop and clarify first. Items may be related — partial understanding leads to wrong implementation.

## Workflow

### 1. READ

Read ALL feedback completely before reacting. Do not start implementing while reading.

### 2. UNDERSTAND

Restate the requirement in your own words. If unclear, ask for clarification. Never assume intent.

### 3. VERIFY

Check against codebase reality. Is the criticism technically correct? Does the codebase actually have the issue described?

For external reviewer feedback, run these checks before implementing:
- Is this technically correct for THIS codebase, not in theory?
- Does this break existing functionality?
- Is there a reason for the current implementation?
- Does it work on all platforms/versions?
- Does the reviewer understand the full context?

### 4. EVALUATE

Is this technically sound for THIS codebase? A suggestion might be correct in theory but wrong for this project's constraints, conventions, or phase.

### 5. RESPOND

Either:
- **Technical acknowledgment**: "Fixed in abc123, added test for edge case."
- **Reasoned pushback**: "This pattern exists in 3 other places in the codebase — changing just this one would be inconsistent without a wider refactor."

### 6. IMPLEMENT

One item at a time. Test each. Commit each. Do not batch feedback items.

## Forbidden Responses

**NEVER:**
- "You're absolutely right!" (performative agreement)
- "Great point!" / "Excellent feedback!" (performative)
- "Let me implement that now" (before verification)
- Any gratitude expression

**INSTEAD:**
- Restate the technical requirement
- Ask clarifying questions
- Push back with technical reasoning if wrong
- Just start working — the fix is the acknowledgment

## Handling Unclear Feedback

```
IF any item is unclear:
  STOP — do not implement anything yet
  ASK for clarification on unclear items

WHY: Items may be related. Partial understanding = wrong implementation.
```

**Example:**
```
Reviewer: "Fix items 1-6"
You understand 1,2,3,6. Unclear on 4,5.

❌ WRONG: Implement 1,2,3,6 now, ask about 4,5 later
✅ RIGHT: "I understand items 1,2,3,6. Need clarification on 4 and 5 before proceeding."
```

## Source-Specific Handling

### From a Trusted Source (human partner, trusted senior)
- High confidence — implement after understanding
- Still ask if scope is unclear
- No performative agreement
- Skip gratitude, go straight to action or technical acknowledgment
- If feedback conflicts with prior decisions, discuss before acting

### From an External Reviewer
- Be skeptical but fair
- Verify thoroughly against codebase reality
- YAGNI check applies aggressively
- If suggestion seems wrong: push back with technical reasoning
- If you can't easily verify: "I can't verify this without [X]. Should I investigate, ask, or proceed?"
- If suggestion conflicts with the human partner's prior decisions: stop and discuss first

## YAGNI Check

If a reviewer says "you should implement this properly" (suggesting a generalized solution), grep the codebase for actual existing usage first:

- If unused: Push back — "This would be speculative generality. YAGNI — happy to revisit when usage emerges."
- If used: Then implement properly

**Rule:** The reviewer and you both serve the same goal. If the generalized feature has no consumers, don't add it.

## Implementation Order

For multi-item feedback:
1. Clarify anything unclear FIRST — do not batch unclear items for later
2. Then implement in this order:
   - Blocking issues (breaks, security vulnerabilities)
   - Simple fixes (typos, imports, naming)
   - Complex fixes (refactoring, logic changes, new patterns)
3. Test each fix individually — no batch-testing
4. Verify no regressions after each fix

## When to Push Back

Push back when the suggestion:
- Breaks existing functionality
- Shows the reviewer lacks full context about the codebase
- Violates YAGNI (implements unused generalization)
- Is technically incorrect for this stack or platform
- Ignores legacy or compatibility constraints
- Conflicts with architectural decisions already made

**How to push back:**
- Use technical reasoning, not defensiveness
- Ask specific questions: "What edge case does this prevent?"
- Reference working tests or existing code patterns
- Involve the human partner if the issue is architectural

**Signal phrase (if uncomfortable pushing back):** "Strange things are afoot at the Circle K"

## Acknowledging Correct Feedback

When feedback IS correct, the response should be action, not gratitude:

```
✅ "Fixed. [Brief description of what changed]"
✅ "Good catch — [specific issue]. Fixed in [location]."
✅ [Just fix it and show the code changed]

❌ "You're absolutely right!"
❌ "Great point!"
❌ "Thanks for catching that!"
```

The code change itself is the acknowledgment.

## Graceful Correction Pattern

If you pushed back but were wrong, acknowledge cleanly:

```
✅ "You were right — I checked [X] and it does [Y]. Implementing now."
✅ "Verified this and you're correct. My initial understanding was wrong because [reason]. Fixing."

❌ Long apology
❌ Defending why you pushed back
❌ Over-explaining
```

State the correction factually and move on.

## GitHub Thread Replies

When replying to inline review comments on GitHub, reply in the comment thread, not as a top-level PR comment.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Performative agreement | State the requirement or just act — no praise |
| Blind implementation | Verify against codebase first |
| Batch without testing | One fix at a time, test each individually |
| Assuming reviewer is always right | Check if it breaks things in this codebase |
| Avoiding pushback | Technical correctness over social comfort |
| Partial understanding | Clarify all items before implementing any |
| Can't verify but proceed anyway | State the limitation, ask for direction |

## Real Examples

**Performative Agreement (Bad):**
```
Reviewer: "Remove legacy code"
❌ "You're absolutely right! Let me remove that..."
```

**Technical Verification (Good):**
```
Reviewer: "Remove legacy code"
✅ "Checking... build target supports this API. Need legacy for backward compat. Fix or drop support?"
```

**YAGNI Pushback (Good):**
```
Reviewer: "Implement proper metrics tracking with database, date filters, CSV export"
✅ "Grepped codebase — nothing calls this endpoint. Remove it (YAGNI)? Or is there usage I'm missing?"
```

## Tool Requirements

- `grep` — codebase search; `git` — committing changes with clear references

## Output

- Technical acknowledgment with specific evidence (commit hash, what changed)
- Reasoned pushback with codebase citations
- Graceful correction when wrong

## Quality Criteria

- No performative agreement phrases
- If feedback is correct, fix it and state what changed without excessive deference
- If feedback is wrong, explain why with technical reasoning backed by codebase evidence
- Implementation proceeds one item at a time, each tested and committed individually
- Unclear items are clarified before any implementation begins
- Pushback is specific and technical, not defensive
- GitHub replies target the specific comment thread, not the top-level PR
## When NOT to Use

No code review feedback, purely stylistic feedback, or reviewer not open to technical discussion.
