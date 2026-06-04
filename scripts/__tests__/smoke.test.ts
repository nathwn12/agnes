import { describe, it, expect, afterAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const scriptsDir = path.resolve(__dirname, '..');

const tempDirs: string[] = [];

const TMP_BASE = path.resolve(repoRoot, '..', '.agnes-test-tmp');

function tmpDir(): string {
  fs.mkdirSync(TMP_BASE, { recursive: true });
  const d = fs.mkdtempSync(path.join(TMP_BASE, 'smoke-'));
  tempDirs.push(d);
  return d;
}

afterAll(() => {
  for (const d of tempDirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function runScript(scriptName: string, args: string[] = [], options: { cwd?: string } = {}) {
  const scriptPath = path.join(scriptsDir, scriptName);
  const proc = Bun.spawnSync(['bun', 'run', scriptPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env },
  });
  return { exitCode: proc.exitCode, stdout: proc.stdout.toString(), stderr: proc.stderr.toString() };
}

describe('init-agnes.ts', () => {
  it('refuses to init at HOME dir', () => {
    const r = runScript('init-agnes.ts', ['--dir', os.homedir()]);
    expect(r.exitCode).toBe(1);
    expect(JSON.parse(r.stdout).status).toBe('error');
  });

  it('refuses to init at a file path', () => {
    const d = tmpDir();
    const filePath = path.join(d, 'test-file');
    fs.writeFileSync(filePath, '', 'utf-8');
    const r = runScript('init-agnes.ts', ['--dir', filePath]);
    expect(r.exitCode).toBe(1);
    expect(JSON.parse(r.stdout).status).toBe('error');
  });

  it('returns status "exists" when .agnes/ already exists', () => {
    const r = runScript('init-agnes.ts', ['--dir', repoRoot]);
    expect(r.exitCode).toBe(0);
    expect(JSON.parse(r.stdout).status).toBe('exists');
  });

  it('creates state in temp dir with --with-plan --goal "test"', () => {
    const d = tmpDir();
    Bun.spawnSync(['git', 'init'], { cwd: d });
    const r = runScript('init-agnes.ts', ['--dir', d, '--with-plan', '--goal', 'test']);
    expect(r.exitCode).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.status).toBe('created');
    expect(out.initialPlan).toBeTruthy();
    expect(fs.existsSync(path.join(d, '.agnes', 'index.json'))).toBe(true);
    expect(fs.existsSync(path.join(d, '.agnes', 'plans', `${out.initialPlan}.yaml`))).toBe(true);
  });
});

describe('state-stats.ts', () => {
  it('returns stats when .agnes/ exists', () => {
    const r = runScript('state-stats.ts', ['--dir', repoRoot]);
    expect(r.exitCode).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(['ok', 'empty']).toContain(out.status);
    expect(typeof out.planCount).toBe('number');
    expect(out.planCount).toBeGreaterThanOrEqual(0);
  });

  it('returns "no_agnes_state" on dir without .agnes/', () => {
    const d = tmpDir();
    const r = runScript('state-stats.ts', ['--dir', d]);
    expect(r.exitCode).toBe(0);
    expect(JSON.parse(r.stdout).status).toBe('no_agnes_state');
  });
});

describe('release.ts', () => {
  it('detects wrong repo name', () => {
    const d = tmpDir();
    fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ name: 'not-agnes', version: '1.0.0' }), 'utf-8');
    const scriptsSubdir = path.join(d, 'scripts');
    fs.mkdirSync(scriptsSubdir, { recursive: true });
    const target = path.join(scriptsSubdir, 'release.ts');
    fs.copyFileSync(path.join(scriptsDir, 'release.ts'), target);
    const proc = Bun.spawnSync(['bun', 'run', target], {
      cwd: d,
      env: { ...process.env },
    });
    expect(proc.exitCode).toBe(1);
    expect(proc.stderr.toString()).toContain('Not the agnes repository');
  });
});
