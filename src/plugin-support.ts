import * as fs from "node:fs";
import * as path from "node:path";

export interface ProjectProfile {
  projectName: string;
  languages: string[];
  packageManager: string;
}

export interface PackageInfoLike {
  version: string;
  root: string;
  skillsDir: string;
}

export function readFileSafe(filePath: string): string {
  try { return fs.readFileSync(filePath, "utf8"); } catch { return ""; }
}

export function stripYamlFrontmatter(content: string): string {
  return content.replace(/^---[\s\S]*?---\n/, "");
}

export function detectProject(cwd: string): ProjectProfile {
  let projectName = path.basename(cwd);
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
    if (pkg.name) projectName = pkg.name;
  } catch {}

  const languages: string[] = [];
  if (fs.existsSync(path.join(cwd, "tsconfig.json"))) languages.push("typescript");
  if (fs.existsSync(path.join(cwd, "go.mod"))) languages.push("go");
  if (fs.existsSync(path.join(cwd, "Cargo.toml"))) languages.push("rust");
  if (fs.existsSync(path.join(cwd, "pyproject.toml"))) languages.push("python");
  if (fs.existsSync(path.join(cwd, "package.json"))) languages.push("javascript");

  const lockfiles: Record<string, string> = { "bun.lock": "bun", "bun.lockb": "bun", "pnpm-lock.yaml": "pnpm", "yarn.lock": "yarn", "package-lock.json": "npm" };
  let packageManager = "npm";
  for (const [lock, name] of Object.entries(lockfiles)) {
    if (fs.existsSync(path.join(cwd, lock))) {
      packageManager = name;
      break;
    }
  }

  return { projectName, languages, packageManager };
}

export function buildProjectProfileSection(profile: ProjectProfile): string {
  const lines: string[] = ["### Project Profile (auto-detected)"];
  if (profile.languages.length > 0) lines.push(`- Languages: ${profile.languages.join(", ")}`);
  lines.push(`- Package manager: ${profile.packageManager}`, "");
  return lines.join("\n");
}

export function buildCompactionContext(input: {
  pkg: PackageInfoLike;
  projectProfile: ProjectProfile | null;
  editedFiles: Iterable<string>;
}): string[] {
  const out: string[] = [];
  out.push("# AGNES Context (preserve across compaction)");
  out.push("", `## AGNES v${input.pkg.version}`);
  out.push(`- Package root: ${input.pkg.root}`);
  out.push("- Primary role: orchestrate subagents, synthesize results, verify before claiming");
  out.push("- Read-only tools are technically safe in main context, but default to delegating discovery and research");
  out.push("- Mutation always delegates to subagents");
  out.push("- Soul: Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution");
  out.push("- Route by task type: planning, review, build-fix, TDD, docs, language-specific");
  out.push("- Answer directly when no tools are needed", "");

  if (input.projectProfile) {
    out.push("## Project Profile");
    out.push(`- Languages: ${input.projectProfile.languages.join(", ") || "none detected"}`);
    out.push(`- Package manager: ${input.projectProfile.packageManager}`, "");
  }

  const edited = [...input.editedFiles];
  if (edited.length > 0) {
    out.push("## Recently Edited Files");
    for (const f of edited) out.push(`- ${f}`);
    out.push("");
  }

  return out;
}
