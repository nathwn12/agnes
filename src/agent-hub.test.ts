import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearDiscoveryCache } from './discovery.js';
import { discoverAgentHub, formatHubSummary } from './agent-hub.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_BASE = path.join(__dirname, '..', '.agnes-test');

function tmpRoot(): string {
  if (!fs.existsSync(TEST_BASE)) fs.mkdirSync(TEST_BASE, { recursive: true });
  return fs.mkdtempSync(path.join(TEST_BASE, 'hub-test-'));
}

function testDir(...segments: string[]): string {
  const dir = path.join(tmpDir, ...segments);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

let tmpDir: string;

describe('discoverAgentHub', () => {
  beforeEach(() => {
    clearDiscoveryCache();
    tmpDir = tmpRoot();
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  test('returns agents, commands, and skills sections', () => {
    const hub = discoverAgentHub(tmpDir);
    expect(hub).toHaveProperty('agents');
    expect(hub).toHaveProperty('commands');
    expect(hub).toHaveProperty('skills');
    expect(Array.isArray(hub.agents)).toBe(true);
    expect(Array.isArray(hub.commands)).toBe(true);
    expect(Array.isArray(hub.skills)).toBe(true);
  });

  test('includes bundled agents with agnes source', () => {
    const hub = discoverAgentHub(tmpDir);
    const planner = hub.agents.find((a) => a.name === 'planner');
    expect(planner).toBeDefined();
    expect(planner!.source).toBe('agnes');
    expect(planner!.type).toBe('agent');
  });

  test('marks bundled agents as not delegatable by default', () => {
    const hub = discoverAgentHub(tmpDir);
    const planner = hub.agents.find((a) => a.name === 'planner');
    expect(planner).toBeDefined();
    expect(planner!.delegatable).toBe(false);
  });

  test('discovers workspace agents when present', () => {
    const agDir = testDir('.opencode', 'prompts', 'agents');
    writeFile(path.join(agDir, 'custom-agent.txt'), 'You are a custom agent.\nDo things.\n');
    const hub = discoverAgentHub(tmpDir);
    const agent = hub.agents.find((a) => a.name === 'custom-agent');
    expect(agent).toBeDefined();
    expect(agent!.source).toBe('workspace');
  });

  test('discovers workspace commands when present', () => {
    const cmdDir = testDir('.opencode', 'commands');
    writeFile(cmdDir + '/ship-it.md', '---\ndescription: Ship to production\n---\nDeploy.\n');
    const hub = discoverAgentHub(tmpDir);
    const cmd = hub.commands.find((c) => c.name === 'ship-it');
    expect(cmd).toBeDefined();
    expect(cmd!.source).toBe('workspace');
    expect(cmd!.type).toBe('command');
  });

  test('discovers workspace skills when present', () => {
    const skillDir = testDir('.opencode', 'skills', 'my-skill');
    writeFile(path.join(skillDir, 'SKILL.md'), '# My Skill\n');
    const hub = discoverAgentHub(tmpDir);
    const skill = hub.skills.find((s) => s.name === 'my-skill');
    expect(skill).toBeDefined();
    expect(skill!.source).toBe('workspace');
    expect(skill!.type).toBe('skill');
  });

  test('includes bundled commands and skills', () => {
    const hub = discoverAgentHub(tmpDir);
    expect(hub.commands.length).toBeGreaterThanOrEqual(11);
    expect(hub.skills.length).toBeGreaterThanOrEqual(20);
  });

  test('caches results (second call returns same data)', () => {
    const first = discoverAgentHub(tmpDir);
    const agDir = testDir('.opencode', 'prompts', 'agents');
    writeFile(path.join(agDir, 'late-agent.txt'), 'You are late.\n');
    const second = discoverAgentHub(tmpDir);
    expect(second.agents.length).toBe(first.agents.length);
  });
});

describe('formatHubSummary', () => {
  test('produces catalog with all three sections', () => {
    clearDiscoveryCache();
    const hub = discoverAgentHub(tmpDir);
    const summary = formatHubSummary(hub);
    expect(summary).toContain('## Agent Hub Catalog');
    expect(summary).toContain('**Agents**');
    expect(summary).toContain('**Commands**');
    expect(summary).toContain('**Skills**');
  });

  test('includes agent names in the table', () => {
    clearDiscoveryCache();
    const hub = discoverAgentHub(tmpDir);
    const summary = formatHubSummary(hub);
    expect(summary).toContain('planner');
  });

  test('shows (none discovered) for empty sections', () => {
    clearDiscoveryCache();
    const hub = discoverAgentHub(tmpDir);
    const emptyHub = { agents: [], commands: [], skills: [] };
    const summary = formatHubSummary(emptyHub);
    expect(summary).toContain('(none discovered)');
  });
});
