# AGNES

AGNES is an OpenCode plugin that provides delegation utilities and structured slash commands.

## Project Commands

| Command | What |
|---------|------|
| `bun run bundle` | Build plugin to .opencode/plugins/agnes.js |
| `bun run bundle:watch` | Watch mode rebuild |
| `bun run lint` | ESLint on src/ |
| `bun run lint:fix` | Auto-fix lint |
| `bun run typecheck` | tsc --noEmit |
| `bun test` | Run all tests |
| `bun run release` | Publish with scripts/release.ts --go |

CI: `bun install -> bun run lint -> bun run typecheck -> bun test -> bun run bundle`

## Architecture

| Path | Role |
|------|------|
| src/plugin.ts | OpenCode entry point. Registers hooks, injects bootstrap, exposes `agnes_delegate`/`agnes_get_result` tools, registers commands and skills path. |
| src/bootstrap.ts | Injects SOUL.md + project profile + mode detection as system prompt. Cached by content hash. Tier-aware: full SOUL.md for large, trimmed for medium, minimal for small. |
| src/delegate.ts | Programmatic subagent delegation with retry (3×, exponential backoff), 120s timeout check, persistent task ref store, and 10min orphan cleanup. |
| src/runtime.ts | Model-tier detection (small/medium/large from model ID), concurrency limits, result truncation, YOLO mode toggle. |
| src/protocol.ts | `<agnes:message>` JSON protocol parsing/serialization. |
| src/schema.ts | Zod schemas for all message types. |
| src/verification.ts | Gate pipeline — non-blocking promise-compliance checks on subagent output. |
| src/discovery.ts | Scans 3 layers for commands (.md files with YAML frontmatter). |
| src/discovery-policy.ts | YAML frontmatter parsing. |
| src/plugin-support.ts | Project profile detection (lang, package manager). |
| src/logger.ts | Stderr logger with [agnes] prefix. |

## Key Details

- **Zero runtime dependencies.** `package.json` has no runtime deps. yaml + zod are bundled inline by `bun build`.
- **Agents**: Only `general` (read/write/research) and `explore` (read-only). These are OpenCode's built-in subagents. No custom agents.
- **Delegation**: Use `agnes_delegate`/`agnes_get_result` custom tools (built-in `delegate_task`/`get_task_result` are deprecated).
- **Bootstrap**: Injected via `experimental.chat.messages.transform` from SOUL.md. Includes chunking rules, mode detection, and completion protocol.
- **Chunking (mandatory)**: Exploration is always chunked by folder or file group (min 5 files). Cross-cutting grep searches use one subagent. Edits are one-per-subagent, sequenced across import boundaries.
- **Retry + Timeout**: `delegateBlocking` retries 3× with exponential backoff (1s, 3s, 9s). `getSubagentResult` returns TIMEOUT after 120s. Orphan sessions auto-clean after 10min.
- **Skills**: 10 skills in `.opencode/skills/`, auto-discovered by OpenCode via plugin config hook.
- **Commands**: All workflows are slash commands in `.opencode/commands/*.md` (14 commands).
- **State dir**: `.agnes/` at project root. Persists task refs for async subagent tracking across restarts.
- **Build**: Single-file bundle via `bun build src/plugin.ts --target bun`.

## Release Checklist (every version bump)

After pushing a version bump:
1. `bun run bundle` — rebuild `.opencode/plugins/agnes.js`
2. Nuke both caches so OpenCode picks up the new version:
   - `Remove-Item -Recurse -Force Q:\PROJECTS\PERSONAL\agnes\.agnes`
   - `Remove-Item -Recurse -Force "$env:USERPROFILE\.cache\opencode\packages\agnes@git+https_*"`
3. Restart OpenCode

## Code Conventions

- **Runtime deps**: 0. Pin @opencode-ai/plugin to ^1.15.x (dev only).
- **Strict TS**: strict: true, ES2022, NodeNext module resolution, noUnusedLocals/Parameters.
- **Lint**: ESLint 10 + @typescript-eslint.
- **Tests**: *.test.ts next to source, excluded from tsconfig.
- **SOUL.md**: Chunking section is source of truth for orchestrator behavior. Keep in sync with bootstrap strings.

## Generated Files (do not hand-edit)

- .opencode/plugins/agnes.js
- .opencode/plans/
- .opencode/INSTALL.md
- .opencode/index.json
- .agnes/
- node_modules/
