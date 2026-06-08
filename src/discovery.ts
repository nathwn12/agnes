import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { fileURLToPath } from "node:url";
import { findPackageRoot } from "./bootstrap.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = findPackageRoot(__dirname) ?? path.resolve(__dirname, "..", "..");
const BUNDLED_COMMANDS_DIR = path.join(pluginRoot, ".opencode", "commands");

export interface CommandDiscovery {
  name: string;
  desc: string;
  template: string;
  source: "agnes" | "global" | "workspace";
}

function readFileSafe(filePath: string): string {
  try { return fs.readFileSync(filePath, "utf8"); } catch { return ""; }
}

function stripYamlFrontmatter(content: string): string {
  return content.replace(/^---[\s\S]*?---\n/, "");
}

function parseCommandFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) {
      let value: unknown = kv[2].trim();
      if (value === "true") value = true;
      else if (value === "false") value = false;
      else if ((value as string).startsWith('"') && (value as string).endsWith('"')) value = (value as string).slice(1, -1);
      result[kv[1]] = value;
    }
  }
  return result;
}

function homeDir(): string {
  return process.env.USERPROFILE || os.homedir();
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
        source,
      });
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

const cachedCommands = new Map<string, CommandDiscovery[]>();

function cacheKey(worktreePath: string): string {
  return path.resolve(worktreePath);
}

export function clearDiscoveryCache(): void {
  cachedCommands.clear();
}

export function discoverCommands(worktreePath: string): CommandDiscovery[] {
  const key = cacheKey(worktreePath);
  const cached = cachedCommands.get(key);
  if (cached) return cached;
  const discovered = scanCommandDir(BUNDLED_COMMANDS_DIR, "agnes");
  const global = scanCommandDir(globalDir("commands"), "global");
  const workspace = scanCommandDir(workspaceDir(worktreePath, "commands"), "workspace");
  const seen = new Set<string>();
  const results: CommandDiscovery[] = [];
  for (const cmd of [...discovered, ...global, ...workspace]) {
    if (!seen.has(cmd.name)) {
      seen.add(cmd.name);
      results.push(cmd);
    }
  }
  cachedCommands.set(key, results);
  return results;
}
