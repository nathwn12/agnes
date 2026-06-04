# AGNES — OpenCode Plugin

Swarm orchestrator. Routes work across 22 skills. Delegates aggressively, parallelizes by default, never mutates directly.

## Tool routing

- Read/search/lookup → @explore
- Modify/create/run/delete → @general
- Destructive/irreversible → Ask user

## Commands

| Command | What |
|---------|------|
| bun run bundle | Build single-file plugin to .opencode/plugins/agnes.js |
| bun run bundle:watch | Watch mode rebuild |
| bun run lint | ESLint on src/ |
| bun run lint:fix | Auto-fix lint |
| bun run typecheck | tsc --noEmit |
| bun test | 476 tests, 15 suites |
| bun test src/FILE.test.ts | Single test file |
| bun test -t "pattern" | Single test pattern |
| bun run release | Publish with scripts/release.ts --go |
| bun run init-agnes | Run scripts/init-agnes.ts |

CI runs: bun install -> bun run lint -> bun run typecheck -> bun test -> bun run bundle

## Architecture

| Path | Role |
|------|------|
| src/plugin.ts | OpenCode entry point. Registers all hooks, injects bootstrap, registers skills/commands/agents. |
| src/bootstrap.ts | Injects SOUL.md + structured YAML blocks as system prompt. Cached by content hash. |
| src/state.ts | Plan index CRUD -- .agnes/index.json + plans/plan-NNN.yaml. Immutable plan files, append-only iterations. |
| src/runtime.ts | Session tracking, attempt counting, struggle detection, wave dispatch, planner routing, gate integration. |
| src/protocol.ts | <agnes:message> JSON protocol (task/result/error/status/completion). |
| src/schema.ts | Zod schemas for Plan, Bootstrap Block, Message. |
| src/shell.ts | Detects pwsh/bash/git-bash/cmd/wsl. Cached per-process. Uses MSYSTEM env for Git Bash. |
| src/validation.ts | Allowlist-based message validation and injection protection. escapeUserData() prefixes protocol-keyed fields with __user_. |
| src/discovery.ts | Scans 3 layers (bundled/global/workspace) for agents, commands, skills. |
| src/discovery-policy.ts | YAML frontmatter parsing, agent permission inference (executor/explorer/reviewer/etc), merge-by-name dedup. |
| src/model-routing.ts | Reads model routing config from ~/.config/opencode/agnes.json. Routes agents to specific models. |
| src/model-routing-policy.ts | Config types, default model, agent list population, apply logic. |
| src/plugin-support.ts | Project profile detection (langs, pkg manager), compaction context builder. |
| src/verification.ts | Structured gates (PASS/FAIL/SKIP) with blocking gate short-circuit. |
| src/compaction.ts | Token-count evaluation (nudge/alert/compact) with discretionary struggle-aware thresholds. |
| src/logger.ts | Stderr logger -- debug/info/warn/error with [agnes] prefix. |

## Key quirks

- **State dir**: .agnes/ at project root, not .cache/. Auto-prunes done/abandoned plans after 7 days.
- **Bootstrap cache**: Invalidated when package version or SOUL.md content hash changes.
- **Model routing config**: ~/.config/opencode/agnes.json -- auto-heals with defaults if missing.
- **No opencode.json in repo**: Plugin is installed via opencode.json in the workspace using config, not stored here.
- **Locked file**: nul at repo root -- Windows sentinel, do not touch.
- **Skills**: 22 bundled SKILL.md files live in .opencode/skills/. Registered by discoverSkills() at plugin startup.
- **Agent permissions**: Defined in discovery-policy.ts. executor gets bash access (no git commit/push); explorer/reviewer/planner/architect get read-only.
- **Completion protocol**: Agent ends tasks with an HTML comment <agnes:message> containing a completion or result JSON message -- parsed by AGNES.
- **Plugin build**: Single-file bundle via bun build src/plugin.ts --target bun, output is require()-able by OpenCode.

## Code conventions

- **Runtime deps**: yaml + zod. Pin @opencode-ai/plugin to ^1.15.x.
- **No Biome**: ESLint 10 + @typescript-eslint. Separate config for src vs test files.
- **Strict TS**: strict: true, ES2022, NodeNext module resolution, noUnusedLocals/Parameters.
- **Lint rules**: no-unused-vars (warn), no-explicit-any (warn), no-require-imports (error), no-console (warn).
- **Tests**: *.test.ts next to source, excluded from tsconfig. Shared utils in src/test-utils.ts. describe/it blocks.
- **Commits**: Title only, <72 chars, imperative present tense. Never commit without explicit request.

## Generated files (do not hand-edit)

- .opencode/plugins/agnes.js -- bundle output
- .opencode/plans/ -- gitignored
- .opencode/INSTALL.md -- gitignored
- .opencode/index.json -- gitignored
- .agnes/ -- gitignored (plan state, sessions, learnings)
- node_modules/ -- gitignored