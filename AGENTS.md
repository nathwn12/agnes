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
| src/bootstrap.ts | Injects SOUL.md + project profile + mode detection as system prompt. Cached by content hash. |
| src/delegate.ts | Programmatic subagent delegation with verification gates. Creates child sessions, sends prompts, polls for results. |
| src/runtime.ts | Session mode state (question-gate/YOLO). |
| src/protocol.ts | `<agnes:message>` JSON protocol parsing/serialization. |
| src/schema.ts | Zod schemas for all message types. |
| src/verification.ts | Gate pipeline — runGates, promise compliance checks on subagent output. |
| src/discovery.ts | Scans 3 layers for commands (.md files with YAML frontmatter). |
| src/discovery-policy.ts | YAML frontmatter parsing. |
| src/plugin-support.ts | Project profile detection (lang, package manager). |
| src/logger.ts | Stderr logger with [agnes] prefix. |

## Key Details

- **Agents**: Only `general` (read/write/research) and `explore` (read-only). These are OpenCode's built-in subagents. No custom agents.
- **Delegation**: Use `agnes_delegate`/`agnes_get_result` custom tools (built-in `delegate_task`/`get_task_result` are deprecated).
- **Bootstrap**: Injected via `experimental.chat.messages.transform` from SOUL.md. Includes mode detection instruction.
- **Auto-delegation**: Enforced via SOUL.md bootstrap — always decompose by file boundary and parallelize.
- **Skills**: 6 skills in `.opencode/skills/`, auto-discovered by OpenCode via plugin config hook.
- **Commands**: All workflows are slash commands in `.opencode/commands/*.md` (14 commands).
- **State dir**: .agnes/ at project root. Auto-prunes done/abandoned plans after 7 days.
- **Build**: Single-file bundle via `bun build src/plugin.ts --target bun`.

## Code Conventions

- **Runtime deps**: yaml + zod. Pin @opencode-ai/plugin to ^1.15.x.
- **Strict TS**: strict: true, ES2022, NodeNext module resolution, noUnusedLocals/Parameters.
- **Lint**: ESLint 10 + @typescript-eslint.
- **Tests**: *.test.ts next to source, excluded from tsconfig.

## Generated Files (do not hand-edit)

- .opencode/plugins/agnes.js
- .opencode/plans/
- .opencode/INSTALL.md
- .opencode/index.json
- .agnes/
- node_modules/
