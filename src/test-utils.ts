import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const createdDirs: string[] = [];

export function createTempProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'agnes-test-'));
  createdDirs.push(tmp);
  return tmp;
}

export function cleanupTempDirs(): void {
  for (const dir of createdDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  createdDirs.length = 0;
}
