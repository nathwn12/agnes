import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { fileURLToPath } from "node:url";
import { findPackageRoot } from "./runtime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = findPackageRoot(__dirname) ?? path.resolve(__dirname, "..", "..");
const BUNDLED_COMMANDS_DIR = path.join(pluginRoot, ".opencode", "commands");

const CACHE_TTL_MS = 30_000;

export interface CommandDiscovery {
  name: string;
  desc: string;
  template: string;
  source: "agnes" | "global" | "workspace";
}

interface CachedSource {
  commands: CommandDiscovery[];
  files: Record<string, number>;
  cachedAt: number;
}

const _cache = new Map<string, CachedSource>();

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

function globalDir(sub: string): string {
  return path.join(homeDir(), ".config", "opencode", sub);
}

function workspaceDir(worktree: string, sub: string): string {
  return path.join(worktree, ".opencode", sub);
}

function scanWithMtimes(dir: string, source: CommandDiscovery["source"]): { commands: CommandDiscovery[]; files: Record<string, number> } {
  const files: Record<string, number> = {};
  const commands: CommandDiscovery[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const filePath = path.join(dir, entry.name);
      try {
        const stat = fs.statSync(filePath);
        files[filePath] = stat.mtimeMs;
      } catch { continue; }
      const name = entry.name.slice(0, -3);
      const content = readFileSafe(filePath);
      if (!content) continue;
      const fm = parseCommandFrontmatter(content);
      const template = stripYamlFrontmatter(content);
      if (!template) continue;
      commands.push({
        name,
        desc: (fm.description as string) || name.replace(/-/g, " "),
        template,
        source,
      });
    }
  } catch { /* dir missing */ }
  return { commands, files };
}

function cacheKey(worktreePath: string): string {
  return path.resolve(worktreePath);
}

function isCacheFresh(cached: CachedSource): boolean {
  return Date.now() - cached.cachedAt < CACHE_TTL_MS;
}

function hasMtimesChanged(cached: CachedSource): boolean {
  for (const [filePath, mtime] of Object.entries(cached.files)) {
    try {
      if (fs.statSync(filePath).mtimeMs !== mtime) return true;
    } catch { return true; }
  }
  return false;
}

export function clearDiscoveryCache(): void {
  _cache.clear();
}

export function forceRescan(worktreePath: string): void {
  _cache.delete(cacheKey(worktreePath));
}

export function discoverCommands(worktreePath: string): CommandDiscovery[] {
  const key = cacheKey(worktreePath);
  const cached = _cache.get(key);

  if (cached) {
    if (isCacheFresh(cached) && !hasMtimesChanged(cached)) {
      return cached.commands;
    }
    _cache.delete(key);
  }

  const bundled = scanWithMtimes(BUNDLED_COMMANDS_DIR, "agnes");
  const global = scanWithMtimes(globalDir("commands"), "global");
  const workspace = scanWithMtimes(workspaceDir(worktreePath, "commands"), "workspace");

  const seen = new Set<string>();
  const results: CommandDiscovery[] = [];
  const allFiles: Record<string, number> = {};

  for (const scan of [bundled, global, workspace]) {
    Object.assign(allFiles, scan.files);
    for (const cmd of scan.commands) {
      if (!seen.has(cmd.name)) {
        seen.add(cmd.name);
        results.push(cmd);
      }
    }
  }

  _cache.set(key, { commands: results, files: allFiles, cachedAt: Date.now() });
  return results;
}
