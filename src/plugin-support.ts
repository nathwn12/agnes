import * as fs from "node:fs";
import * as path from "node:path";

export interface ProjectProfile {
  projectName: string;
  languages: string[];
  packageManager: string;
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


