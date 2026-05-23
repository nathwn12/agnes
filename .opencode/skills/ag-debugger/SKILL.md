---
id: ag-debugger
phase: "DEBUG"
use_when: "User says \"this is broken, help me figure out why\", error reports without clear root cause, performance regressions needing investigation."
version: 1.0
---

## Use When

User says "this is broken, help me figure out why", error reports without clear root cause, performance regressions needing investigation.

## Core Concept

Structured 7-step collaborative debugging loop: Reproduce → Explore → Hypothesise → Ask → Instrument → Narrow → Document. The user is a partner at every decision point — hypotheses are presented for guidance, findings are shared immediately, and no step advances without user awareness.

## Precise Vocabulary

- **Hypothesis**: A falsifiable, specific, ranked statement about the root cause. Must name the module and define how to disprove it.
- **Instrumentation**: Targeted logging or assertions with tagged markers (e.g. `[DEBUG-a4f2]`) for easy cleanup.
- **Narrowing**: Sequential elimination of hypotheses by instrumenting one variable at a time.
- **Reproduction**: Confirming the bug with the user's exact steps, input, environment, and expected vs actual behavior.
- **Root Cause**: The minimal underlying fault — one sentence.
- **Falsifiable**: Can be proven wrong by a specific experiment.

## Context Requirements

- Access to source code and relevant files
- Git history for recent changes (`git log --oneline -20`)
- Error logs, stack traces, or console output
- Ability to run code and add instrumentation
- User availability to answer clarifying questions (one at a time)

## Workflow

### 1. Reproduce
Confirm the bug with the user:
- "What did you expect to happen?"
- "What actually happened?"
- "Can you share the exact steps, input, and output?"
- "What environment? (OS, Node version, browser, etc.)"
- If possible, try to reproduce yourself

### 2. Explore
Look at relevant code, recent changes, and error logs:
- Check recent commits: `git log --oneline -20`
- Read the relevant source files
- Look for error logs, stack traces, or console output
- Check for known issues or recent dependency changes
- Use ag-explorer patterns to understand the affected area

### 3. Hypothesise
Propose 2-3 falsifiable hypotheses, ranked by probability:
- "Hypothesis 1 (80%): The token refresh logic has a race condition. If true, adding a mutex should fix it."
- "Hypothesis 2 (15%): The API endpoint changed its response format. If true, checking the network tab should show a different schema."
- "Hypothesis 3 (5%): A recent dependency update broke compatibility. If true, reverting `package.json` changes should fix it."

Each hypothesis must be:
- Specific — "the X module" not "somewhere in the code"
- Falsifiable — "changing Y will make the bug disappear"
- Ranked — by likelihood, not wishful thinking

### 4. Ask User
Present hypotheses to the user. Let them guide which to test first.

> "Here are my top hypotheses. Which should I start with? Or do you have a different theory?"

### 5. Instrument
Add targeted logging or assertions, one variable at a time:
- Tag debug logs with a unique marker for easy cleanup: `[DEBUG-a4f2]`
- For performance: baseline measurement first, then bisect
- Share findings with the user after each instrumentation

### 6. Narrow
Share findings, ask the next question, repeat until root cause found:
- "I added logging to the token refresh call. It seems like the old token is being cached. Should I investigate the cache invalidation logic next?"
- Use the narrowing process to eliminate hypotheses

### 7. Document
Record root cause and reproduction steps:
```markdown
## Bug: [Title]

### Root Cause
[One sentence]

### Reproduction
1. Step 1
2. Step 2

### Fix
[Description or reference to the fix PR/commit]
```

## Tool Requirements

- **git**: Check recent commits and changes
- **logging**: Add tagged instrumentation markers for targeted debugging
- **explorer**: Use ag-explorer patterns to understand affected code areas
- **hypothesis-testing**: Propose and rank falsifiable hypotheses by probability

## Output

A bug report with root cause (one sentence), reproduction steps, and fix reference, collated incrementally through the narrowing process.

## Quality Criteria

- One question asked at a time — never two
- Each hypothesis is specific, falsifiable, and ranked by likelihood
- Debug logs tagged with unique markers for cleanup
- User is consulted at every decision point before proceeding
- Findings shared immediately after each instrumentation round

## When NOT to Use

- No reproduction steps available and user cannot provide them
- Bug is in a third-party dependency with no workaround — report upstream instead
- If after 3 rounds of narrowing the root cause is still unclear, handoff to ag-griller for adversarial debugging
