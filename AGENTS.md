# AGNES

AGNES is an OpenCode plugin that provides delegation utilities and structured slash commands.

## Commands (13)

| Command | What |
|---------|------|
| `/plan` | Implementation plan with risk assessment |
| `/build-fix` | Fix build/TypeScript errors with minimal changes |
| `/code-review` | Review code for quality, security, maintainability |
| `/tdd` | TDD workflow (RED → GREEN → REFACTOR) |
| `/security` | Security vulnerability review |
| `/verify` | Run verification loop (typecheck + lint + test + build) |
| `/e2e` | Generate and run Playwright E2E tests |
| `/checkpoint` | Save verification state and progress |
| `/learn` | Extract patterns and learnings from session |
| `/test-coverage` | Analyze test coverage |
| `/update-docs` | Update documentation |
| `/update-codemaps` | Update codebase maps |
| `/refactor-clean` | Remove dead code |

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
| src/plugin.ts | OpenCode entry point. Registers hooks, injects bootstrap, exposes `agnes_delegate`/`agnes_get_result` tools, registers commands. |
| src/bootstrap.ts | Injects SOUL.md as system prompt. Cached by content hash. |
| src/delegate.ts | Programmatic subagent delegation via OpenCode client API. Creates child sessions, sends prompts, polls for results. |
| src/discovery.ts | Scans 3 layers for commands (.md files with YAML frontmatter). |
| src/state.ts | Plan index CRUD — .agnes/ state management. |
| src/runtime.ts | Session tracking, attempt counting, struggle detection, planner routing. |
| src/protocol.ts | `<agnes:message>` JSON protocol parsing. |
| src/schema.ts | Zod schemas for Plan, Bootstrap Block, Message. |
| src/validation.ts | Allowlist-based message validation. |
| src/discovery-policy.ts | YAML frontmatter parsing. |
| src/plugin-support.ts | Project profile detection, compaction context. |
| src/compaction.ts | Token-count evaluation and compaction thresholds. |
| src/logger.ts | Stderr logger with [agnes] prefix. |

## Key Details

- **Agents**: Only `explore` (read/search) and `build` (modify/create). No custom agents.
- **Commands**: All workflows are slash commands in `.opencode/commands/*.md`.
- **Delegation**: Use `agnes_delegate`/`agnes_get_result` custom tools (built-in `delegate_task`/`get_task_result` are deprecated).
- **Bootstrap**: Injected via `experimental.chat.messages.transform` from SOUL.md.
- **State dir**: .agnes/ at project root. Auto-prunes done/abandoned plans after 7 days.
- **Build**: Single-file bundle via `bun build src/plugin.ts --target bun`.

## Code Conventions

- **Runtime deps**: yaml + zod. Pin @opencode-ai/plugin to ^1.15.x.
- **Strict TS**: strict: true, ES2022, NodeNext module resolution, noUnusedLocals/Parameters.
- **Lint**: ESLint 10 + @typescript-eslint.
- **Tests**: *.test.ts next to source, excluded from tsconfig. Shared utils in src/test-utils.ts.

## Generated Files (do not hand-edit)

- .opencode/plugins/agnes.js
- .opencode/plans/
- .opencode/INSTALL.md
- .opencode/index.json
- .agnes/
- node_modules/
