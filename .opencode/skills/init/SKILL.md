---
id: init
name: init
description: 'You need to set up AGNES in a new project, or update an existing project''s AGENTS.md and state files in .agnes/.'
phase: "SETUP"
use_when: "You need to set up AGNES in a new project, or update an existing project's AGENTS.md and state files in .agnes/."
version: 1.1
---

# init

**Tradeoff:** Bootstraps full AGNES workflow — state dirs, plan index, AGENTS.md. ~2KB overhead. Skip if no swarm orchestration.

## Core Concept
Creates `.agnes/` (state files) and AGENTS.md at project root. AGENTS.md: always-on rules only; everything else in skills.

## Vocabulary
- **Project root** — first ancestor with `package.json`, `.git`, or `.opencode`
- **State files** — `.agnes/{index,config,sessions}.json`, `learnings/`, `specs/`, `plans/plan-NNN.yaml`
- **AGENTS.md** — root config consumed every agent turn
- **Handoff** — saved session state for another agent

## Requirements
- Target project dir (walk up from CWD to find root)
- Write permission for `.agnes/` and AGENTS.md
- Existing files with real content preserved; empty templates only overwritten

## Workflow

### Phase 1: Find project root
Walk up from CWD. First ancestor with `package.json`, `.git`, or `.opencode`.
→ verify: resolved path exists with ≥1 marker.

### Phase 2: Create `.agnes/` files
Create `.agnes/` if absent. Write:

#### `.agnes/index.json`
```json
{"agnesVersion":"0.4.4","schemaVersion":2,"projectDir":"<project-root>","projectName":"<project-basename>","updatedAt":"<ISO timestamp>","activePlanId":null,"plans":[]}
```
#### `.agnes/config.json`
```json
{"agnesVersion":"0.12.0","schemaVersion":2,"projectDir":"<project-root>","projectName":"<project-basename>","updatedAt":"<ISO timestamp>"}
```
#### `.agnes/sessions.json`
```json
{"sessions":[]}
```
#### `.agnes/learnings/`, `.agnes/specs/`
Create dirs. Never overwrite existing entries.

#### `.agnes/plans/plan-001.yaml`
```yaml
schema: agnes/plan-v1
id: plan-001
status: draft
createdAt: <now>
updatedAt: <now>
summary: "<describe>"
parent: null
total: 1
completed: 0
blocked: 0
```
Preserve existing files with real content.
→ verify: created files valid JSON/YAML. Existing content untouched.

### Phase 3: Create/update AGENTS.md
Write/update AGENTS.md at project root. If exists, prepend AGNES block:

```markdown
# AGNES — OpenCode Native Plugin
Swarm orchestrator routing tasks across fused skills.
## Swarm Ethos (Always Active)
1. **Delegate or die.** Writing code? STOP → subagent.
2. **Parallelize by default.** Sequential is exception.
3. **1% Rule.** ≥1% skill applies → invoke it.
4. **Verify before claiming.** Run command, read output.
5. **Scarcity.** Cheapest sufficient path first.
6. **Work-steal.** Early subagent → next task.
7. **Main context clean.** No source work. Talk, delegate, manage `.agnes/`.
8. **One task = N subagents.** Parallelize by independent unit.
9. **Fresh wave = fresh subagents.** No reuse.
10. **Closed-loop.** PLAN→REVIEW→IMPLEMENT→TEST / FIX→REVIEW→VERIFY.
11. **No shared file edits.** Never two subagents on same file.
12. **Self-audit before every response.** Boundary violation → blocked handoff.
## Key Rules
- No completion claims without fresh verification.
- One question at a time.
- User review gate before implementation.
- Check `.agnes/index.json` for active plans on start.
- No plan? Create `plan-NNN.yaml`, update `index.json`.
- Plan sources immutable after creation.
- Every state change → new plan iteration.
- Update `index.json` after each iteration.
- Stuck/stopping → blocked plan iteration.
---
[existing AGENTS.md content continues]
```
→ verify: AGNES block at top. Existing content below divider.

### Phase 4: Verify
1. `.agnes/index.json` valid JSON
2. `.agnes/config.json`, `sessions.json`, `learnings/`, `specs/` exist
3. `.agnes/plans/plan-001.yaml` exists
4. AGENTS.md has AGNES block at top
→ verify: all 4 pass.

## Tools
| Tool | Phase(s) | Input | Output |
|------|----------|-------|--------|
| Bash | 1, 4 | project path | root dir, filesystem state |
| Read | 2, 3 | existing files | content check |
| Write | 2, 3 | templates | state files |
| Edit | 3 | existing AGENTS.md | prepended block |
| Glob | 1 | markers | root path |

## Examples
| Pattern | Invocation |
|---------|-----------|
| Init fresh project | `init("./new-project")` |
| Update existing | `init("./existing")` |
| Re-init after partial | `init("./corrupt")` |

## Quality Criteria
→ verify: `.agnes/index.json` valid JSON
→ verify: `.agnes/plans/plan-001.yaml` exists
→ verify: AGENTS.md has AGNES block at top
→ verify: existing real-content files unchanged

## Protocol Shells
```
/protocol {
  intent="Initialize AGNES in project",
  input={ project="<dir>", config="<prefs>" },
  process=[ /decompose{steps}, /verify{config}, /synthesize{report} ],
  output={ result="<status>", files="<created-or-updated>" }
}
```

## Cognitive Tools
Use `/decompose` to break setup into config steps, `/verify` to check correctness, `/synthesize` to combine results.

## Skip When
- No swarm orchestration needed
- Single skill only, no full AGNES workflow
- Setup already complete (verified by quality criteria)
