# AGNES — OpenCode Plugin

Swarm orchestrator. Delegates, parallelizes, verifies. Never writes code directly.

## Operational workflow

- **ALWAYS delegate, ALWAYS parallelize** — never do work in main context. Spawn subagents for every read, write, edit, search, bash operation.
- **Never one big task** — split reads into multiple subagents (chunks), split edits into multiple subagents (builders/coders). A single subagent must never be choked.
- **Three-step cycle**: PLAN → REVIEW → IMPLEMENT → FIX/REVISE → ENDORSE. Every task follows this loop. Never skip directly to implementation.
- **If blocked, STOP and ASK** — never continue blindly or guess. Present the user with the block + recommended next step.
- **LEAN** — small, precise subagent tasks. One narrow concern per subagent. Broad tasks are fragmented.

## Quick commands

| Command | What |
|---------|------|
| `bun run bundle` | Build `.opencode/plugins/agnes.js` |
| `bun run bundle:watch` | Watch mode rebuild |
| `bun run lint` | ESLint on `src/` |
| `bun run lint:fix` | Auto-fix lint |
| `bun run typecheck` | `tsc --noEmit` |
| `bun test` | 390+ tests, 13 suites |

CI runs `bun install → typecheck → test → bundle` on push/PR.

Single test: `bun test src/state.test.ts`. Single test pattern: `bun test -t "plan index"`.

## Architecture

- **`src/plugin.ts`** — OpenCode entry point. Hooks: `config`, `session.created`, `chat.message`, `tool.definition`, `tool.execute.after`, `experimental.chat.messages.transform`, `experimental.session.compacting`.
- **`src/bootstrap.ts`** — System prompt injection (SOUL.md + structured YAML blocks). Cached by content hash.
- **`src/state.ts`** — Plan index CRUD (`index.json` + `plans/plan-NNN.yaml`). Immutable plan files, append-only iterations.
- **`src/runtime.ts`** — Session tracking, attempt counting, struggle detection, planner routing.
- **`src/protocol.ts`** — `<agnes:message>` JSON messages (task/result/error/status/completion).
- **`src/schema.ts`** — Zod schemas for Plan, Bootstrap Block, Message.
- **`src/shell.ts`** — Detects pwsh/bash/cmd, caches per-process.
- **`src/compaction.ts`** — Token-count evaluation for session compaction advisory.
- **`src/discovery.ts`** — Scans 3 layers (bundled/global/workspace) for agents, commands, skills.
- **`src/model-routing.ts`** — Reads `openecc.json`, routes agents to reasoning models.
- **`src/verification.ts`** — Gate system (PASS/FAIL/SKIP) with blocking gates.
- **`src/middleware.ts`** — Hook chain (before/after wave, before/after subagent).
- **`src/flowcontrol.ts`** — Ephemeral jump signals (retry/skip/blocked/next_wave/end).

## Key quirks

- **State directory**: `.agnes/` at project root. Not `.cache/agnes/`. Auto-prunes done/abandoned plans after 7 days.
- **Plan files**: YAML (`plan-NNN.yaml`) with JSON Schema validation. Legacy `.md` support preserved.
- **Session state**: Persisted to `.agnes/sessions.json` via atomic tmp+rename.
- **Bootstrap cache**: Invalidated when package version or SOUL.md content hash changes.
- **Shell detection**: Uses `MSYSTEM` env for Git Bash. Runs once at plugin startup.
- **No DS4 branching**: Model-agnostic. `interleaved: { field: "reasoning_content" }` set unconditionally.
- **Locked file**: `nul` is tracked at repo root — Windows sentinel, do not touch.

## Code conventions

- **Runtime deps**: `yaml` + `zod`. Pin `@opencode-ai/plugin` to `^1.15.x`.
- **No Biome**: ESLint 10 + `@typescript-eslint`. Separate config for src vs test files.
- **Strict TS**: `tsconfig.json` with `strict: true`, `ES2022`, `NodeNext` module resolution.
- **Plugin lint rules**: `no-unused-vars` (warn), `no-explicit-any` (warn), `no-require-imports` (error), `no-console` (warn).
- **Test convention**: `*.test.ts` next to source, excluded from tsconfig. Shared test utils in `src/test-utils.ts`. Tests use `describe`/`it` blocks.
- **No body in git commits**: Title only, `<72 chars`, imperative present tense.
- **No commit without explicit request**.

## CI / OpenCode

- **GitHub CI**: `.github/workflows/ci.yml` — Bun + typecheck + test + bundle on push/PR to main.
- **OpenCode on issues/PRs**: `.github/workflows/opencode.yml` — triggered by `/oc` or `/opencode` in comments. Uses `anomalyco/opencode/github@latest` with deepseek-v4-flash.

## Generated files (do not hand-edit)

- `.opencode/plugins/agnes.js` — bundle output from `bun run bundle`
- `.opencode/plans/` — gitignored
- `.opencode/INSTALL.md` — gitignored
- `.opencode/index.json` — gitignored
- `.agnes/` — gitignored (plan state, sessions, learnings)
- `node_modules/` — gitignored
