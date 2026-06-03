import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverAgents,
  discoverCommands,
  discoverSkills,
  clearDiscoveryCache,
} from "./discovery";

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

async function runDiscovery() {
  // Import fresh each call to avoid stale module state
  const mod = await import("./discovery");
  return mod;
}

describe("discoverAgents", () => {
  beforeEach(() => {
    clearDiscoveryCache();
    tmpDir = tmpRoot();
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it("discovers agents from workspace .opencode directory", () => {
    const agDir = testDir(".opencode", "prompts", "agents");
    writeFile(path.join(agDir, "custom-agent.txt"), "You are a custom agent.\nDo things.\n");
    const agents = discoverAgents(tmpDir);
    const agent = agents.find((a) => a.name === "custom-agent");
    expect(agent).toBeDefined();
    expect(agent!.source).toBe("workspace");
    expect(agent!.desc).toBe("custom agent");
  });

  it("discovery is additive for unique names", () => {
    const agDir = testDir(".opencode", "prompts", "agents");
    writeFile(path.join(agDir, "team-agent.txt"), "You are a team agent.\nDo things.\n");
    writeFile(path.join(agDir, "qa-agent.txt"), "You are a QA agent.\nCheck things.\n");
    const agents = discoverAgents(tmpDir);
    const workspace = agents.filter((a) => a.source === "workspace");
    expect(workspace.length).toBe(2);
  });

  it("handles missing workspace directory gracefully", () => {
    clearDiscoveryCache();
    const agents = discoverAgents(path.join(tmpDir, "nonexistent"));
    expect(agents.length).toBe(0);
  });

  it("reads agent prompt content", () => {
    const agDir = testDir(".opencode", "prompts", "agents");
    writeFile(path.join(agDir, "helper.txt"), "You are a helpful assistant.\nAnswer questions.\n");
    const agents = discoverAgents(tmpDir);
    const agent = agents.find((a) => a.name === "helper");
    expect(agent).toBeDefined();
    expect(agent!.prompt).toContain("helpful assistant");
  });

  it("skips non-.txt files in agent directory", () => {
    const agDir = testDir(".opencode", "prompts", "agents");
    writeFile(path.join(agDir, "readme.md"), "# Not an agent\n");
    writeFile(path.join(agDir, "real.txt"), "You are a real agent.\n");
    const agents = discoverAgents(tmpDir);
    const workspace = agents.filter((a) => a.source === "workspace");
    expect(workspace.length).toBe(1);
    expect(workspace[0].name).toBe("real");
  });
});

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

  it("handles frontmatter parsing for workspace commands", () => {
    const cmdDir = testDir(".opencode", "commands");
    writeFile(cmdDir + "/custom.md", "---\ndescription: Custom\nagent: planner\nsubtask: true\n---\nRun planner.\n");
    const cmds = discoverCommands(tmpDir);
    const cmd = cmds.find((c) => c.name === "custom");
    expect(cmd).toBeDefined();
    expect(cmd!.agent).toBe("planner");
    expect(cmd!.subtask).toBe(true);
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
    expect(cmds.length).toBe(0);
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

describe("discoverSkills", () => {
  beforeEach(() => {
    clearDiscoveryCache();
    tmpDir = tmpRoot();
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it("discovers skills from workspace .opencode directory", () => {
    const skillDir = testDir(".opencode", "skills", "ws-skill");
    writeFile(path.join(skillDir, "SKILL.md"), "# Workspace Skill\nDo things.\n");
    const skills = discoverSkills(tmpDir);
    expect(skills.some((s) => s.endsWith("ws-skill"))).toBe(true);
  });

  it("deduplicates skill paths from bundled and workspace", () => {
    // Create workspace skill with same name — no conflict since bundled has none
    const skillDir = testDir(".opencode", "skills", "test-skill");
    writeFile(path.join(skillDir, "SKILL.md"), "# Test Skill\n");
    const skills = discoverSkills(tmpDir);
    const dirs = skills.map((s) => path.basename(s));
    expect(new Set(dirs).size).toBe(dirs.length);
  });

  it("handles missing workspace directory gracefully", () => {
    clearDiscoveryCache();
    const skills = discoverSkills(path.join(tmpDir, "nonexistent"));
    expect(skills.length).toBeGreaterThanOrEqual(27);
  });

  it("ignores directories without SKILL.md", () => {
    const skillDir = testDir(".opencode", "skills", "not-a-skill");
    writeFile(path.join(skillDir, "README.md"), "# Not a skill\n");
    const otherDir = testDir(".opencode", "skills", "actual-skill");
    writeFile(path.join(otherDir, "SKILL.md"), "# Actual Skill\n");
    const skills = discoverSkills(tmpDir);
    const names = skills.map((s) => path.basename(s));
    expect(names).not.toContain("not-a-skill");
    expect(names).toContain("actual-skill");
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

  it("discoverAgents returns cached result on second call", () => {
    const agDir = testDir(".opencode", "prompts", "agents");
    writeFile(path.join(agDir, "first.txt"), "You are first.\n");
    const first = discoverAgents(tmpDir);
    writeFile(path.join(agDir, "late.txt"), "You are late.\n");
    const second = discoverAgents(tmpDir);
    expect(second.length).toBe(first.length);
  });

  it("clearDiscoveryCache resets and picks up new agents", () => {
    const agDir = testDir(".opencode", "prompts", "agents");
    writeFile(path.join(agDir, "old.txt"), "You are old.\n");
    discoverAgents(tmpDir);
    clearDiscoveryCache();
    writeFile(path.join(agDir, "fresh.txt"), "You are fresh.\n");
    const agents = discoverAgents(tmpDir);
    expect(agents.some((a) => a.name === "fresh")).toBe(true);
  });

  it("each discovery type has independent cache", () => {
    clearDiscoveryCache();
    const agDir = testDir(".opencode", "prompts", "agents");
    writeFile(path.join(agDir, "agent.txt"), "You are agent.\n");
    discoverAgents(tmpDir);
    const cmdDir = testDir(".opencode", "commands");
    writeFile(cmdDir + "/cmd.md", "---\ndescription: Cmd\n---\nDo.\n");
    clearDiscoveryCache();
    const cmds = discoverCommands(tmpDir);
    const workspace = cmds.filter((c) => c.source === "workspace");
    expect(workspace.length).toBe(1);
  });
});
