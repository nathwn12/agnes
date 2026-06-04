#!/usr/bin/env bun
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { stringify as yamlStringify } from 'yaml';

function readPackageVersion(): string {
  try {
    const scriptDir = path.dirname(process.argv[1]);
    const pkgPath = path.resolve(scriptDir, '..', 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    if (typeof pkg.version === 'string' && pkg.version) return pkg.version;
    return '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dirFlag = args.indexOf('--dir');
  let projectDir: string;
  if (dirFlag >= 0) {
    const val = args[dirFlag + 1];
    if (!val || val.startsWith('--')) {
      projectDir = process.env.AGNES_PROJECT_DIR || process.cwd();
    } else {
      projectDir = path.resolve(val);
    }
  } else {
    projectDir = process.env.AGNES_PROJECT_DIR || process.cwd();
  }
  let createPlan = args.includes('--with-plan');
  const goalFlag = args.indexOf('--goal');
  const goal = goalFlag >= 0 && args[goalFlag + 1] && !args[goalFlag + 1].startsWith('--') ? args[goalFlag + 1] : '';
  const versionFlag = args.indexOf('--version');
  const versionOverride = versionFlag >= 0 && args[versionFlag + 1] && !args[versionFlag + 1].startsWith('--') ? args[versionFlag + 1] : undefined;

  if (goal && !createPlan) {
    createPlan = true;
  }

  return { projectDir, createPlan, goal, versionOverride };
}

function isUnsafeTarget(dir: string): boolean {
  const resolved = path.resolve(dir);
  if (resolved === os.homedir()) return true;
  if (/^[A-Za-z]:\\$/.test(resolved)) return true;
  if (resolved === '/') return true;
  return false;
}

function findOrInferProjectRoot(startDir: string): string {
  let root = path.resolve(startDir);
  if (!fs.existsSync(root)) return root;
  const markers = ['.git', 'package.json', 'go.mod', 'Cargo.toml', 'pyproject.toml', 'Gemfile', 'composer.json', 'Makefile', 'justfile'];
  for (let i = 0; i < 10; i++) {
    for (const marker of markers) {
      if (fs.existsSync(path.join(root, marker))) return root;
    }
    const parent = path.dirname(root);
    if (parent === root) break;
  }
  return root;
}

function hasGitignoreAgnesEntry(content: string): boolean {
  return content.split('\n').some(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return false;
    return /(^|\/)\.agnes($|\/)/.test(trimmed);
  });
}

function getNextPlanId(plansDir: string): string {
  fs.mkdirSync(plansDir, { recursive: true });
  let max = 0;
  try {
    for (const f of fs.readdirSync(plansDir)) {
      const m = f.match(/^plan-(\d+)\.yaml$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  } catch { /* ok */ }
  return `plan-${String(max + 1).padStart(3, '0')}`;
}

function main() {
  try {
    const { projectDir, createPlan, goal, versionOverride } = parseArgs();

    if (isUnsafeTarget(projectDir)) {
      console.log(JSON.stringify({
        status: 'error',
        message: `Refusing to initialize AGNES at unsafe path: ${projectDir}`,
      }));
      process.exit(1);
    }

    if (fs.existsSync(projectDir)) {
      const stat = fs.statSync(projectDir);
      if (!stat.isDirectory()) {
        console.log(JSON.stringify({
          status: 'error',
          message: '--dir must be a directory, not a file',
        }));
        process.exit(1);
      }
    }

    const root = findOrInferProjectRoot(projectDir);
    const agnesDir = path.join(root, '.agnes');
    const plansDir = path.join(agnesDir, 'plans');
    const indexPath = path.join(agnesDir, 'index.json');
    const gitignorePath = path.join(root, '.gitignore');

    if (fs.existsSync(indexPath)) {
      console.log(JSON.stringify({
        status: 'exists',
        message: `AGNES state already exists at ${root}`,
        projectRoot: root,
      }));
      process.exit(0);
    }

    if (fs.existsSync(agnesDir) && !fs.existsSync(indexPath)) {
      console.log(JSON.stringify({
        status: 'partial_state',
        message: `AGNES directory exists at ${agnesDir} but index.json is missing. Manual cleanup may be required.`,
        agnesDir,
      }));
      process.exit(1);
    }

    fs.mkdirSync(plansDir, { recursive: true });
    const now = new Date().toISOString();
    const version = versionOverride || readPackageVersion();

    const index: {
      agnesVersion: string;
      schemaVersion: number;
      projectDir: string;
      projectName: string;
      updatedAt: string;
      activePlanId: string | null;
      plans: Array<Record<string, unknown>>;
    } = {
      agnesVersion: version,
      schemaVersion: 2,
      projectDir: root,
      projectName: path.basename(root),
      updatedAt: now,
      activePlanId: null,
      plans: [],
    };

    const tmpPath = indexPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(index, null, 2), 'utf-8');
    fs.renameSync(tmpPath, indexPath);

    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      if (!hasGitignoreAgnesEntry(content)) {
        const eol = content.endsWith('\n') ? '' : '\n';
        fs.appendFileSync(gitignorePath, `${eol}/.agnes\n`);
      }
    }

    let initialPlan: string | null = null;

    if (createPlan) {
      const summary = goal || 'Initialize AGNES orchestration';
      initialPlan = getNextPlanId(plansDir);
      const plan = {
        schema: 'agnes/plan-v1',
        id: initialPlan,
        version: 1,
        createdAt: now,
        updatedAt: now,
        status: 'draft',
        parent: null,
        goal: goal || summary,
        check: 'TBD',
        summary: summary.length > 80 ? summary.slice(0, 80) + '...' : summary,
        tasks: [] as unknown[],
        notes: [] as string[],
      };
      const planPath = path.join(plansDir, `${initialPlan}.yaml`);
      fs.writeFileSync(planPath, yamlStringify(plan, null, { indent: 2 }), 'utf-8');

      index.plans.push({
        id: initialPlan,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
        summary: plan.summary,
        total: 0,
        completed: 0,
        blocked: 0,
        file: `${initialPlan}.yaml`,
        attempts: 0,
        struggle: { noProgressIterations: 0, repeatedErrors: {}, shortIterations: 0, lastPromiseTag: null },
      });
      index.activePlanId = initialPlan;
      index.updatedAt = now;
      fs.writeFileSync(tmpPath, JSON.stringify(index, null, 2), 'utf-8');
      fs.renameSync(tmpPath, indexPath);
    }

    console.log(JSON.stringify({
      status: 'created',
      projectRoot: root,
      projectName: index.projectName,
      agnesDir,
      planCount: 0,
      initialPlan,
      message: initialPlan
        ? `AGNES initialized at ${root} with plan ${initialPlan}`
        : `AGNES initialized at ${root}. Add --with-plan --goal "..." to create the first plan.`,
    }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({
      status: 'error',
      error: msg,
    }));
    process.exit(1);
  }
}

main();
