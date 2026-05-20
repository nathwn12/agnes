# Installing AGNES for OpenCode

## Prerequisites

- [OpenCode.ai](https://opencode.ai) installed

## Installation

Add AGNES to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["agnes@git+https://github.com/nathwn12/agnes.git"]
}
```

Restart OpenCode. The plugin installs through OpenCode's plugin manager and
registers all 15 fused skills.

Verify by asking: "Tell me about yourself, AGNES"

## Updating

OpenCode installs AGNES through a git-backed package spec. Some OpenCode
and Bun versions pin the resolved git dependency in a lockfile, so a restart
may not pick up the newest commit. If updates do not appear, clear OpenCode's
package cache or reinstall the plugin.

To pin a specific version:

```json
{
  "plugin": ["agnes@git+https://github.com/nathwn12/agnes.git#v0.1.0"]
}
```

## Troubleshooting

### Plugin not loading

1. Check logs: `opencode run --print-logs "hello" 2>&1 | findstr agnes`
2. Verify the plugin line in your `opencode.json`
3. Make sure you're running a recent version of OpenCode

### Skills not found

1. Use the `skill` tool to list what's discovered
2. Check that the plugin is loading (see above)

## Development

```bash
bun install
bun run build
bun run typecheck
```

## Getting Help

- Report issues: https://github.com/nathwn12/agnes/issues
