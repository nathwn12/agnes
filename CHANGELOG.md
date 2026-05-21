# Changelog

All notable changes to AGNES are documented here.

## 0.4.4 (2026-05-21)

### Fixed

- **Frontmatter truncation regression (0.4.3)**: Replaced broken 4 KB header read in `readFrontmatter()` with a single-read-per-file helper that always parses the full frontmatter — no more silent status drops when closing `---` lands past byte 4096. (verified: `bun test`, `bun run typecheck`)
- **File descriptor leak**: Removed manual `openSync`/`readSync`/`closeSync` from `readFrontmatter()` — eliminated the descriptor leak on read errors that was introduced in 0.4.3. (verified: `bun test`)
- **Duplicate file reads on hot path**: `buildStateInjectionStrings()` and `getCurrentState()` now share one `getStateSnapshot()` call per message transform, so each state file is read exactly once instead of 4–6 times. (verified: `src/state.ts` diff, `src/plugin.ts` diff)

## 0.4.3 (2026-05-21)

### Fixed

- **Part structural compliance**: Bootstrap injection now constructs a fully valid `TextPart` with `id`, `sessionID`, and `messageID` — prevents downstream rejection or silent drops when OpenCode validates message part shapes. (verified: `bun run typecheck`, emitted JS inspection)

### Fixed (retroactively corrected in 0.4.4)

- **Frontmatter read performance (regression)**: Reverted full-file read in `readFrontmatter()` — restored 4KB header-only read to eliminate latency on the chat-transform hot path, but inadvertently truncated frontmatter when closing `---` landed past byte 4096. Fixed in 0.4.4. (verified: `bun test`)

## 0.4.2 (2026-05-21)

### Fixed

- **Cache invalidation**: Bootstrap cache now invalidates when `ag-orchestrator/SKILL.md` mtime or package version changes — no more stale bootstraps after updates. (verified: `bun run bundle && bun run typecheck`)
- **Silent error swallowing**: Replaced empty catch blocks in `plugin.ts` with `console.debug` — state read failures are now observable during debugging. (verified: code review)
- **Spelling**: Normalized British `Initialise` → American `Initialize` in `AGENTS.md` — consistent with codebase convention. (verified: visual diff)

### Changed

- **State file schema**: Reduced from 4 to 3 files (`session.md` removed). Runtime now only watches `goal.md`, `plan.md`, `handoff.md`. All skills and docs aligned. (verified: `grep` confirms zero references to `session.md` in runtime)
- **README skill table**: Added missing `ag-orchestrator` entry — table now matches the 23-skill badge. (verified: count matches)
- **Pipeline diagram**: Added missing `→ Debug →` phase between Verify/Review and Ship. (verified: visual diff)

### Improved

- **Plugin performance**: Single workspace-root traversal per message transform — `detectStateDirectory()` called once, result shared across state injection and plan gate. (verified: `src/plugin.ts` diff)
- **Frontmatter parsing**: Replaced fragile 4KB buffer read with full file read for frontmatter extraction — no more truncation on large files. (verified: `src/state.ts` diff)
- **Code hygiene**: Removed dead `findProjectRoot()` function, unnecessary spread `{...ref}` in message injection. (verified: `git diff --stat`)

### Dev

- **Pinned dependency**: `@opencode-ai/plugin` pinned to `^1.15.5` — no more floating `latest` surprises. (verified: `package.json`)
