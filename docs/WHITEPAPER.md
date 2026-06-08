# AGNES Whitepaper

> Swarm orchestrator for OpenCode — 9 bundled skills, 14 commands, parallel by default, zero runtime deps.

---

## How It Works

AGNES is an OpenCode plugin that installs into OpenCode's tool system. It injects a bootstrap prompt (Constitution preamble + SOUL.md) into every conversation, then routes work through subagent delegation.

**Chunking.** Exploration splits by folder or file group (minimum 5 files per chunk). All chunks fire in parallel, respecting model-tier concurrency. Cross-cutting searches (grep across the whole tree) use one subagent. File edits are one per subagent, sequenced across import boundaries.

**Retry & timeout.** Transient failures retry with exponential backoff — 1s, 3s, 9s. Subagents that stall past 120s return TIMEOUT. Orphaned sessions auto-clean after 10 minutes.

**Model-tier adaptive.** Auto-detects model size (small/medium/large) and adjusts concurrency (3/5/10) and result truncation (2K/4K/8K chars). DeepSeek and OpenCode models always run as large. Override with `AGNES_MODEL_TIER`.

**YOLO mode.** Skip all question gates. Maximum parallelization. Safety-only interrupts. Activate with `--yolo`, `--auto`, or `/yolo` in the first message.

---

## Architecture

AGNES is 11 modules, each with a single responsibility:

| Module | Purpose |
|--------|---------|
| **`src/plugin.ts`** | OpenCode entry point — registers 4 tools (`agnes_delegate`, `agnes_get_result`, `agnes_orchestrate`, `agnes_orchestrate_status`), hooks, commands, skills path |
| **`src/bootstrap.ts`** | Injects Constitution preamble (~750 chars, DeepSeek cache-stable) + SOUL.md. Tier-aware (small/medium/large). Re-injected on compaction |
| **`src/delegate.ts`** | Subagent delegation — `delegateBlocking` (sync, 3× retry), `delegateAsync` (fire-and-forget), `getSubagentResult` (poll). Persistent task ref store at `.agnes/task-refs.json` |
| **`src/runtime.ts`** | Model-tier detection, concurrency limits (3/5/10), result truncation (2K/4K/8K chars), YOLO mode toggle, Semaphore |
| **`src/protocol.ts`** | Compact `§AM{...}` message format with key-shortening + legacy HTML comment parsing (`<!-- <agnes:message>... -->`) |
| **`src/schema.ts`** | Type definitions + validation for 5 message types (task/result/error/status/completion) |
| **`src/verification.ts`** | Promise Compliance Gate — non-blocking check for completion envelope in subagent output |
| **`src/orchestrator.ts`** | Full plan → decompose → delegate → review → iterate cycle. 4 tools: create, advance, wave scheduling, review gates |
| **`src/planner.ts`** | Plan state machine — create, save, load, update plans. Task items with status tracking |
| **`src/scheduler.ts`** | Topological wave sort with file-conflict detection and resolution |
| **`src/reviewer.ts`** | Orchestration review gates — task completion + file conflict checks |
| **`src/aggregator.ts`** | Wave polling — waits for batch of subagents to complete, handles timeouts |
| **`src/discovery.ts`** | 3-layer command scanning: bundled `.opencode/commands/` → `~/.config/opencode/commands/` → project `.opencode/commands/` |
| **`src/plugin-support.ts`** | Project profile detection — language, package manager from lockfiles |
| **`src/logger.ts`** | Stderr logger — **silent by default**, enable with `AGNES_DEBUG=1` |

---

## Skills

9 bundled skills, auto-discovered from `.opencode/skills/`:

| Skill | Purpose |
|-------|---------|
| **auto-delegate** | Automatic subagent routing for common patterns |
| **auto-verify** | Run typecheck/lint/tests before claiming done |
| **brainstorming** | Explore ambiguous creative direction, generate proposals |
| **code-review** | Structured code review with spec + standards axes |
| **question-gate** | Pause on 3+ file changes, architecture decisions, new deps |
| **quick-investigate** | Rapid focused exploration for targeted questions |
| **subagent-driven-development** | Full SDD pipeline: spec → implement → review → iterate |
| **writing-plans** | Decompose spec into ordered implementation plan |
| **yolo-mode** | Skip gates, max parallelism, safety-only interrupts |

---

## Commands

14 bundled commands:

| Command | What |
|---------|------|
| `/plan` | Decompose spec into implementation steps |
| `/build-fix` | Fix type/build errors across codebase |
| `/code-review` | Review code against standards + spec |
| `/tdd` | Test-driven development red-green-refactor |
| `/verify` | Run typecheck, lint, tests, build |
| `/checkpoint` | Save session state as checkpoint |
| `/learn` | Discover and document codebase patterns |
| `/security` | Security audit pass |
| `/e2e` | End-to-end test generation and review |
| `/update-docs` | Sync docs with recent code changes |
| `/refactor-clean` | Refactor without behavior change |
| `/test-coverage` | Fill test coverage gaps |
| `/update-codemaps` | Refresh codebase map files |
| `/yolo` | Autonomous mode — skip gates |

---

## Tools

4 custom tools registered by AGNES:

| Tool | Type | What |
|------|------|------|
| `agnes_delegate` | Blocking/Async | Delegate task to subagent. `background=true` for async polling |
| `agnes_get_result` | Polling | Retrieve async subagent result by task reference |
| `agnes_orchestrate` | Orchestration | Full plan → decompose → delegate → review → iterate cycle |
| `agnes_orchestrate_status` | Polling | Check + advance orchestration state machine |

Built-in `delegate_task` / `get_task_result` are deprecated (description patched via `tool.definition` hook).

---

## Delegation Protocol

Messages use a compact format to minimize token usage:

```
§AM{"t":"result","tid":"task-000","s":"DONE","c":"..."}
```

Key aliases: `t`→type, `tid`→taskId, `s`→status, `c`→content, `a`→artifact.

Legacy format also supported: `<!-- <agnes:message>...</agnes:message> -->`

5 message types: `task`, `result`, `error`, `status`, `completion`.

---

## State

AGNES persists task references to `.agnes/task-refs.json` for async subagent tracking across restarts. Plans are saved to `.opencode/plans/plan-*.json`. No other persistent state.

Orphaned subagent sessions are cleaned up after 10 minutes of inactivity.

---

## Pipeline

The orchestration flow when using `agnes_orchestrate`:

1. **PLAN** → decompose goal into tasks (topological wave sort)
2. **SCHEDULE** → detect file conflicts, resolve by demotion
3. **DELEGATE** → dispatch wave in parallel (limited by model-tier concurrency)
4. **POLL** → aggregate wave results with timeout
5. **REVIEW** → gate on completion + file conflicts
6. **ITERATE** → failed tasks retry with narrower scope, up to `maxIterations`
7. **COMPLETE** → all waves done, all gates pass

For simpler requests, individual `agnes_delegate` calls skip the orchestration pipeline entirely.

---

## Ethos

| Principle | Meaning |
|-----------|---------|
| **Coordinator coordinates** | AGNES routes, merges, and reports. Subagents execute. |
| **Parallelize by default** | Scan every task set for independence. Sequential is the exception. |
| **Verify before claiming** | Run the command. Read the output. Then speak. |
| **Scarcity** | Cheapest sufficient path — shallow-first, context as budget. |
| **Promise-driven execution** | Non-blocking gates track completion envelopes. |
| **Direct when simple** | Simple question? Answer directly. No delegation overhead. |

---

## Development

```bash
bun run bundle        # Build → .opencode/plugins/agnes.js
bun run bundle:watch  # Watch mode rebuild
bun run lint          # ESLint on src/ (ESLint 10 + @typescript-eslint)
bun run lint:fix      # Auto-fix
bun run typecheck     # tsc --noEmit (strict, ES2022, NodeNext)
bun test              # 95 tests across 10 suites
bun run release       # Publish (dry run without --go)
```

### Tech

- Runtime: Bun
- Language: TypeScript (strict)
- Deps: `@opencode-ai/plugin` ^1.15.x (dev-only). Zero runtime dependencies.
- Lint: ESLint 10
- Build: Single-file bundle via `bun build --target bun`

CI order: `lint → typecheck → test → bundle`

---

## Troubleshooting

### Clear cached installation

> **Root cause**: The cache folder has deep `node_modules` trees. The `+` / `@` / `#` chars in the path and Windows MAX_PATH (260-char limit) cause most one-liners to silently fail.

#### PowerShell (reliable)
```powershell
Remove-Item -LiteralPath "\\?\$env:USERPROFILE\.cache\opencode\packages\agnes@git+https_" -Recurse -Force
```

#### cmd.exe
```cmd
rmdir /s /q "\\?\%USERPROFILE%\.cache\opencode\packages\agnes@git+https_"
```

#### Bash (Linux / macOS)
```bash
rm -rf "$HOME/.cache/opencode/packages"/agnes@git+https_*
```

Then restart OpenCode.
