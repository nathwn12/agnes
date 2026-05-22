import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const createdDirs: string[] = [];

export function createTempProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'agnes-test-'));
  mkdirSync(join(tmp, '.agnes'));
  mkdirSync(join(tmp, '.agnes', 'plans'));
  createdDirs.push(tmp);
  return tmp;
}

export function cleanupTempDirs(): void {
  for (const dir of createdDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  createdDirs.length = 0;
}

export function writeIndex(tmpDir: string, index: any): void {
  writeFileSync(join(tmpDir, '.agnes', 'index.json'), JSON.stringify(index, null, 2));
}

export function readIndex(tmpDir: string): any {
  return JSON.parse(readFileSync(join(tmpDir, '.agnes', 'index.json'), 'utf-8'));
}
