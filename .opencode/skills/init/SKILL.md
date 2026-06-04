---
name: init
id: init
phase: SETUP
description: 'Set up AGNES in a new project, or update existing AGENTS.md and state files in .agnes/.'
---
## RULES
- Create `.agnes/index.json`, config.json, sessions.json, learnings/, specs/, plans/plan-NNN.yaml
- Write/update AGENTS.md at project root
- AGENTS.md minimal: always-on swarm ethos + state rules only
- Existing state files with real content preserved
- Walk up from CWD. First dir with package.json, .git, or .opencode = root

## FLOW
1. Find project root — walk up from CWD
2. Create `.agnes/` if missing. Write state files with templates
3. Write/update AGENTS.md. If exists, prepend AGNES block
4. Verify: index.json valid JSON, all files exist, AGENTS.md has AGNES block

## TRIGGERS
- New project needs AGNES setup
- Existing project needs AGENTS.md or state file update

## OUTPUT
- AGENTS.md with always-on rules
- `.agnes/` with config.json, index.json, sessions.json, learnings/, specs/, plans/plan-001.yaml

## QUALITY
- index.json exists and valid JSON, plan-001.yaml exists
- AGENTS.md contains AGNES block at top
- Existing state files with real content unchanged
