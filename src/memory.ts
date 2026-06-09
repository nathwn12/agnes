import * as path from 'node:path';
import { createDebouncedFileWriter, ensureDir, loadJsonFile } from './persist.js';
import type { DebouncedFileWriter } from './persist.js';

export interface MemoryEntry {
  key: string;
  value: string;
  createdAt: number;
  updatedAt: number;
  ttl: number;
  category: 'user' | 'project' | 'session' | 'pattern' | 'pref';
}

const DEFAULT_TTL: Record<MemoryEntry['category'], number> = {
  user: 0,
  project: 0,
  session: 7 * 24 * 60 * 60 * 1000,
  pattern: 30 * 24 * 60 * 60 * 1000,
  pref: 0,
};

const MAX_ENTRIES = 50;
const MAX_VALUE_LENGTH = 500;
const FORMAT_MAX_CHARS = 2000;

export function extractLessons(text: string, store: MemoryStore): void {
  const lessonRegex = /LESSON:\s*(.+)/g;
  let match;
  while ((match = lessonRegex.exec(text)) !== null) {
    const lesson = match[1].trim();
    if (!lesson) continue;
    const existing = store.list('pattern').find(e => e.value === lesson);
    if (existing) {
      existing.updatedAt = Date.now();
      continue;
    }
    const key = `pattern/auto/${lesson.slice(0, 40).replace(/\s+/g, '_').toLowerCase()}`;
    store.set(key, lesson.slice(0, MAX_VALUE_LENGTH), 'pattern');
  }
}

export class MemoryStore {
  private _entries: MemoryEntry[] = [];
  private _writer: DebouncedFileWriter | null = null;

  get entryCount(): number {
    return this._entries.length;
  }

  load(worktreePath: string): void {
    const filePath = path.join(worktreePath, '.agnes', 'memory.json');
    ensureDir(filePath);
    this._entries = loadJsonFile<MemoryEntry>(filePath, []);
    this._writer = createDebouncedFileWriter(
      () => filePath,
      () => this._entries,
    );
    this.prune();
  }

  save(): void {
    this._writer?.flushSave();
  }

  get(key: string): MemoryEntry | null {
    this.prune();
    const entry = this._entries.find(e => e.key === key);
    if (!entry) return null;
    if (entry.ttl > 0 && Date.now() - entry.updatedAt > entry.ttl) {
      this.delete(key);
      return null;
    }
    return entry;
  }

  set(key: string, value: string, category: MemoryEntry['category'], ttl?: number): boolean {
    if (!key) return false;
    if (value.length > MAX_VALUE_LENGTH) {
      value = value.slice(0, MAX_VALUE_LENGTH);
    }
    this.prune();
    const existing = this._entries.find(e => e.key === key);
    const now = Date.now();
    if (existing) {
      existing.value = value;
      existing.updatedAt = now;
      if (ttl !== undefined) existing.ttl = ttl;
      existing.category = category;
    } else {
      if (this._entries.length >= MAX_ENTRIES) return false;
      this._entries.push({
        key,
        value,
        createdAt: now,
        updatedAt: now,
        ttl: ttl ?? DEFAULT_TTL[category] ?? 0,
        category,
      });
    }
    this._writer?.scheduleSave();
    return true;
  }

  delete(key: string): void {
    this._entries = this._entries.filter(e => e.key !== key);
    this._writer?.scheduleSave();
  }

  list(category?: MemoryEntry['category']): MemoryEntry[] {
    this.prune();
    if (category) return this._entries.filter(e => e.category === category);
    return [...this._entries];
  }

  prune(): void {
    const now = Date.now();
    const before = this._entries.length;
    this._entries = this._entries.filter(
      e => e.ttl === 0 || now - e.updatedAt <= e.ttl
    );
    if (this._entries.length !== before) this._writer?.scheduleSave();
  }

  clear(): void {
    this._entries = [];
    this._writer?.scheduleSave();
  }

  formatForPrompt(): string {
    this.prune();
    if (this._entries.length === 0) return '';

    const lines: string[] = [];
    let total = 0;
    for (const e of this._entries) {
      const line = `- [${e.category}] ${e.key}: ${e.value}`;
      total += line.length + 1;
      if (total > FORMAT_MAX_CHARS) {
        lines.push(`- ... and ${this._entries.length - lines.length + 1} more entries`);
        break;
      }
      lines.push(line);
    }

    return `**AGNES remembers:**\n${lines.join('\n')}`;
  }
}
