import * as fs from 'node:fs';
import * as path from 'node:path';

const DEBOUNCE_MS = 500;

export interface DebouncedFileWriter {
  scheduleSave(): void;
  flushSave(): void;
}

export function createDebouncedFileWriter(
  getPath: () => string,
  getData: () => object,
): DebouncedFileWriter {
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;

  function saveSync(): void {
    dirty = false;
    try {
      fs.writeFileSync(getPath(), JSON.stringify(getData(), null, 2), 'utf8');
    } catch { /* silent */ }
  }

  function scheduleSave(): void {
    dirty = true;
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (dirty) saveSync();
    }, DEBOUNCE_MS);
  }

  function flushSave(): void {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveSync();
  }

  return { scheduleSave, flushSave };
}

export function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadJsonFile<T>(filePath: string, fallback: T[]): T[] {
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as T[];
      return Array.isArray(data) ? data : fallback;
    }
  } catch { /* silent */ }
  return fallback;
}
