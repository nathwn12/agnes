import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverCommands,
  clearDiscoveryCache,
} from "./discovery.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_BASE = path.join(__dirname, "..", ".agnes-test");

function tmpRoot(): string {
  if (!fs.existsSync(TEST_BASE)) fs.mkdirSync(TEST_BASE, { recursive: true });
  return fs.mkdtempSync(path.join(TEST_BASE, "disc-test-"));
}

let tmpDir: string;

function testDir(...segments: string[]): string {
  const dir = path.join(tmpDir, ...segments);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

describe("discoverCommands", () => {
  beforeEach(() => {
    clearDiscoveryCache();
    tmpDir = tmpRoot();
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it("discovers commands from workspace .opencode directory", () => {
    const cmdDir = testDir(".opencode", "commands");
    writeFile(cmdDir + "/ship-it.md", "---\ndescription: Ship it command\n---\nDeploy to production.\n");
    const cmds = discoverCommands(tmpDir);
    const cmd = cmds.find((c) => c.name === "ship-it");
    expect(cmd).toBeDefined();
    expect(cmd!.source).toBe("workspace");
    expect(cmd!.desc).toBe("Ship it command");
  });

  it("commands are additive for unique names", () => {
    const cmdDir = testDir(".opencode", "commands");
    writeFile(cmdDir + "/cmd1.md", "---\ndescription: First\n---\nDo first.\n");
    writeFile(cmdDir + "/cmd2.md", "---\ndescription: Second\n---\nDo second.\n");
    const cmds = discoverCommands(tmpDir);
    const workspace = cmds.filter((c) => c.source === "workspace");
    expect(workspace.length).toBe(2);
  });

  it("handles missing workspace directory gracefully", () => {
    clearDiscoveryCache();
    const cmds = discoverCommands(path.join(tmpDir, "nonexistent"));
    expect(cmds.length).toBe(14);
  });

  it("skips non-.md files in command directory", () => {
    const cmdDir = testDir(".opencode", "commands");
    writeFile(cmdDir + "/note.txt", "Not a command.\n");
    writeFile(cmdDir + "/real.md", "---\ndescription: Real\n---\nDo real.\n");
    const cmds = discoverCommands(tmpDir);
    const workspace = cmds.filter((c) => c.source === "workspace");
    expect(workspace.length).toBe(1);
    expect(workspace[0].name).toBe("real");
  });

  it("handles commands without frontmatter", () => {
    const cmdDir = testDir(".opencode", "commands");
    writeFile(cmdDir + "/simple.md", "Just some text.\nDo the thing.\n");
    const cmds = discoverCommands(tmpDir);
    const cmd = cmds.find((c) => c.name === "simple");
    expect(cmd).toBeDefined();
    expect(cmd!.desc).toBe("simple");
  });
});

describe("discovery caching", () => {
  beforeEach(() => {
    clearDiscoveryCache();
    tmpDir = tmpRoot();
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it("scopes command cache by worktree path", () => {
    const otherDir = tmpRoot();
    try {
      writeFile(path.join(testDir(".opencode", "commands"), "first.md"), "---\ndescription: First\n---\nDo first.\n");
      writeFile(path.join(otherDir, ".opencode", "commands", "second.md"), "---\ndescription: Second\n---\nDo second.\n");

      const first = discoverCommands(tmpDir);
      const second = discoverCommands(otherDir);

      expect(first.some((command) => command.name === "first")).toBe(true);
      expect(first.some((command) => command.name === "second")).toBe(false);
      expect(second.some((command) => command.name === "second")).toBe(true);
      expect(second.some((command) => command.name === "first")).toBe(false);
    } finally {
      try { fs.rmSync(otherDir, { recursive: true, force: true }); } catch {}
    }
  });
});
