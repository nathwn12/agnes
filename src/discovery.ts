import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { fileURLToPath } from "node:url";
import { findPackageRoot } from "./bootstrap.js";
import { stripYamlFrontmatter } from "./plugin-support.js";
import { inferAgentDesc, inferAgentPermission, mergeByName, parseCommandFrontmatter } from "./discovery-policy.js";

export type AgentPermissionValue = string | Record<string, string>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = findPackageRoot(__dirname) ?? path.resolve(__dirname, "..", "..");
const BUNDLED_AGENTS_DIR = path.join(pluginRoot, ".opencode", "prompts", "agents");
const BUNDLED_COMMANDS_DIR = path.join(pluginRoot, ".opencode", "commands");
const BUNDLED_SKILLS_DIR = path.join(pluginRoot, ".opencode", "skills");

export interface AgentDiscovery {
  name: string;
  desc: string;
  prompt: string;
  permission?: Record<string, AgentPermissionValue>;
  source: "agnes" | "global" | "workspace";
}

export interface CommandDiscovery {
  name: string;
  desc: string;
  template: string;
  agent?: string;
  subtask?: boolean;
  source: "agnes" | "global" | "workspace";
}

function readFileSafe(filePath: string): string {
  try { return fs.readFileSync(filePath, "utf8"); } catch { return ""; }
}

function homeDir(): string {
  return process.env.USERPROFILE || os.homedir();
}

function scanAgentDir(dir: string, source: AgentDiscovery["source"]): AgentDiscovery[] {
  const results: AgentDiscovery[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".txt")) continue;
      const name = entry.name.slice(0, -4);
      const prompt = readFileSafe(path.join(dir, entry.name));
      if (!prompt) continue;
      results.push({ name, desc: inferAgentDesc(name, prompt), prompt, permission: inferAgentPermission(name), source });
    }
  } catch { /* dir missing — skip */ }
  return results;
}

function scanCommandDir(dir: string, source: CommandDiscovery["source"]): CommandDiscovery[] {
  const results: CommandDiscovery[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const name = entry.name.slice(0, -3);
      const content = readFileSafe(path.join(dir, entry.name));
      if (!content) continue;
      const fm = parseCommandFrontmatter(content);
      const template = stripYamlFrontmatter(content);
      if (!template) continue;
      results.push({
        name,
        desc: (fm.description as string) || name.replace(/-/g, " "),
        template,
        agent: fm.agent as string | undefined,
        subtask: fm.subtask as boolean | undefined,
        source,
      });
    }
  } catch { /* dir missing — skip */ }
  return results;
}

function scanSkillDir(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (fs.existsSync(path.join(dir, entry.name, "SKILL.md"))) {
        results.push(path.join(dir, entry.name));
      }
    }
  } catch { /* dir missing — skip */ }
  return results;
}

function globalDir(sub: string): string {
  return path.join(homeDir(), ".config", "opencode", sub);
}

function workspaceDir(worktree: string, sub: string): string {
  return path.join(worktree, ".opencode", sub);
}

const cachedAgents = new Map<string, AgentDiscovery[]>();
const cachedCommands = new Map<string, CommandDiscovery[]>();
const cachedSkills = new Map<string, string[]>();

function cacheKey(worktreePath: string): string {
  return path.resolve(worktreePath);
}

export function clearDiscoveryCache(): void {
  cachedAgents.clear();
  cachedCommands.clear();
  cachedSkills.clear();
}

export function discoverAgents(worktreePath: string): AgentDiscovery[] {
  const key = cacheKey(worktreePath);
  const cached = cachedAgents.get(key);
  if (cached) return cached;
  const discovered = mergeByName([
    scanAgentDir(BUNDLED_AGENTS_DIR, "agnes"),
    scanAgentDir(globalDir(path.join("prompts", "agents")), "global"),
    scanAgentDir(workspaceDir(worktreePath, path.join("prompts", "agents")), "workspace"),
  ]);
  cachedAgents.set(key, discovered);
  return discovered;
}

export function discoverCommands(worktreePath: string): CommandDiscovery[] {
  const key = cacheKey(worktreePath);
  const cached = cachedCommands.get(key);
  if (cached) return cached;
  const discovered = mergeByName([
    scanCommandDir(BUNDLED_COMMANDS_DIR, "agnes"),
    scanCommandDir(globalDir("commands"), "global"),
    scanCommandDir(workspaceDir(worktreePath, "commands"), "workspace"),
  ]);
  cachedCommands.set(key, discovered);
  return discovered;
}

export function discoverSkills(worktreePath: string): string[] {
  const key = cacheKey(worktreePath);
  const cached = cachedSkills.get(key);
  if (cached) return cached;
  const bundled = scanSkillDir(BUNDLED_SKILLS_DIR);
  const global = scanSkillDir(globalDir("skills"));
  const workspace = scanSkillDir(workspaceDir(worktreePath, "skills"));
  const seen = new Set<string>();
  const results: string[] = [];
  for (const dir of [...bundled, ...global, ...workspace]) {
    if (!seen.has(dir)) {
      seen.add(dir);
      results.push(dir);
    }
  }
  cachedSkills.set(key, results);
  return results;
}
