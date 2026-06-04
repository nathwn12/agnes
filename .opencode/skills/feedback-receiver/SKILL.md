---
id: feedback-receiver
name: feedback-receiver
description: 'Received code review feedback (from human or automated reviewer), need to evaluate and act on comments without blind acceptance.'
phase: "REVIEW"
use_when: "Received code review feedback (from human or automated reviewer), needing to evaluate or merge external review feedback and act on comments without blind acceptance."
version: 1.2
---

## Use When

Received code review feedback (human or automated), evaluate and act without blind acceptance.

## Core Concept

Technical evaluation, not performative agreement. Verify before implementing. Ask before assuming. Push back with technical reasoning when wrong.

**Core principle:** Technical correctness over social comfort. Code shows you heard the feedback.

## Precise Vocabulary

- **Performative agreement**: Agreeing without technical evaluation
- **Technical acknowledgment**: Confirming fix with evidence (commit hash, what changed)
- **Reasoned pushback**: Disagreeing with technical reasoning backed by evidence
- **YAGNI**: You Ain't Gonna Need It — rejecting speculative generality
- **Graceful correction**: Admitting error cleanly when pushback was wrong

## Context Requirements

Approach depends on source:

| Source | Approach |
|--------|----------|
| **Trusted source** (senior engineer, human partner) | High confidence. Verify quickly, implement if sound. Push back only when clearly wrong. |
| **External source** (automated tool, unfamiliar reviewer) | Skeptical but fair. Verify thoroughly. Check project patterns. YAGNI applies. |

Never implement partially understood feedback. If unclear, stop and clarify first.

## Workflow

### 1. READ

Read ALL feedback before reacting. Don't start implementing while reading.

### 2. UNDERSTAND

Restate requirement in own words. If unclear, ask. Never assume intent.

### 3. VERIFY

Check against codebase reality. Is criticism technically correct?

For external feedback:
- Correct for THIS codebase, not in theory?
- Breaks existing functionality?
- Reason for current implementation?
- Works on all platforms/versions?
- Does reviewer understand full context?

### 4. EVALUATE

Technically sound for THIS codebase? Suggestion may be correct in theory but wrong for project's constraints, conventions, or phase.

### 5. RESPOND

Either:
- **Technical acknowledgment**: "Fixed in abc123, added test for edge case."
- **Reasoned pushback**: "This pattern exists in 3 other places — changing just this one would be inconsistent without wider refactor."

### 6. IMPLEMENT

One item at a time. Test each. Commit each. No batching.

## Forbidden Responses

**NEVER:**
- "You're absolutely right!" (performative)
- "Great point!" / "Excellent feedback!" (performative)
- "Let me implement that now" (before verification)
- Any gratitude

**INSTEAD:**
- Restate technical requirement
- Ask clarifying questions
- Push back with technical reasoning if wrong
- Start working — fix is acknowledgment

## Handling Unclear Feedback

```
IF any item unclear:
  STOP — don't implement anything
  ASK for clarification

WHY: Items may be related. Partial understanding = wrong implementation.
```

**Example:**
```
Reviewer: "Fix items 1-6"
You understand 1,2,3,6. Unclear on 4,5.

❌ WRONG: Implement 1,2,3,6 now, ask 4,5 later
✅ RIGHT: "I understand 1,2,3,6. Need clarification on 4 and 5 before proceeding."
```

## Source-Specific Handling

### Trusted Source
- Implement after understanding
- Ask if scope unclear
- No performative agreement
- Skip gratitude, go to action or acknowledgment
- If conflicts with prior decisions, discuss before acting

### External Reviewer
- Skeptical but fair
- Verify thoroughly
- YAGNI check aggressively
- If seems wrong: push back with technical reasoning
- If can't verify: "Can't verify without [X]. Should I investigate, ask, or proceed?"
- If conflicts with trusted source's prior decisions: stop, discuss first

## YAGNI Check

If reviewer says "implement properly" (generalized solution), grep codebase for actual usage:

- Unused: Push back — "Speculative generality. YAGNI — revisit when usage emerges."
- Used: Implement properly

## Implementation Order

For multi-item feedback:
1. Clarify unclear items FIRST
2. Implement in order:
   - Blocking issues (breaks, security)
   - Simple fixes (typos, imports, naming)
   - Complex fixes (refactoring, logic changes)
3. Test each fix individually
4. Verify no regressions after each fix

## When to Push Back

When suggestion:
- Breaks existing functionality
- Shows reviewer lacks codebase context
- Violates YAGNI
- Technically incorrect for stack/platform
- Ignores legacy/compatibility constraints
- Conflicts with architectural decisions

**How to push back:**
- Technical reasoning, not defensiveness
- Ask specific questions: "What edge case does this prevent?"
- Reference working tests or code patterns
- Involve human partner for architectural issues

## Acknowledging Correct Feedback

Action, not gratitude:

```
✅ "Fixed. [Brief description]"
✅ "Good catch — [issue]. Fixed in [location]."
✅ [Fix and show diff]

❌ "You're absolutely right!"
❌ "Great point!"
❌ "Thanks!"
```

Change itself is acknowledgment.

## Graceful Correction

If pushback was wrong:

```
✅ "You were right — checked [X], it does [Y]. Implementing."
✅ "Verified, you're correct. My understanding was wrong because [reason]. Fixing."
```

State factually, move on.

## GitHub Thread Replies

Reply in inline comment threads, not top-level PR.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Performative agreement | State requirement or act — no praise |
| Blind implementation | Verify against codebase first |
| Batch without testing | One at a time, test each |
| Assuming reviewer always right | Check if it breaks things |
| Avoiding pushback | Technical correctness over social comfort |
| Partial understanding | Clarify all items before implementing |
| Can't verify but proceed | State limitation, ask direction |

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
Reviewer: "Implement proper metrics tracking with DB, date filters, CSV export"
✅ "Grepped codebase — nothing calls this. Remove it (YAGNI)? Or missing usage?"
```

## Tool Requirements

- `grep` — codebase search; `git` — committing with clear references

## Output

- Technical acknowledgment with evidence (commit hash, what changed)
- Reasoned pushback with codebase citations
- Graceful correction when wrong

## Quality Criteria

- No performative agreement phrases
- Feedback correct: fix and state what changed without deference
- Feedback wrong: explain why with technical reasoning and evidence
- One item at a time, each tested and committed
- Unclear items clarified before implementation
- Pushback specific and technical, not defensive
- GitHub replies in comment threads, not top-level

## When NOT to Use

No code review feedback, purely stylistic feedback, or reviewer not open to technical discussion.
