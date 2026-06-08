import * as fs from 'node:fs';
import * as path from 'node:path';

export interface MemoryEntry {
  key: string;
  value: string;
  createdAt: number;
  updatedAt: number;
  ttl: number;
  category: 'user' | 'project' | 'session' | 'pattern' | 'pref';
}

export const DEFAULT_TTL: Record<MemoryEntry['category'], number> = {
  user: 0,
  project: 0,
  session: 7 * 24 * 60 * 60 * 1000,
  pattern: 30 * 24 * 60 * 60 * 1000,
  pref: 0,
};

const MAX_ENTRIES = 50;
const MAX_VALUE_LENGTH = 500;
const DEBOUNCE_MS = 500;
const FORMAT_MAX_CHARS = 2000;

export function extractLessons(text: string, store: MemoryStore): void {
  const lessonRegex = /LESSON:\s*(.+)/g;
  let match;
  while ((match = lessonRegex.exec(text)) !== null) {
    const lesson = match[1].trim();
    if (!lesson) continue;
    const key = `pattern/auto/${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    store.set(key, lesson.slice(0, MAX_VALUE_LENGTH), 'pattern');
  }
}

export class MemoryStore {
  private _entries: MemoryEntry[] = [];
  private _path: string = '';
  private _saveTimer: ReturnType<typeof setTimeout> | null = null;
  private _dirty = false;

  get entryCount(): number {
    return this._entries.length;
  }

  load(worktreePath: string): void {
    this._path = path.join(worktreePath, '.agnes', 'memory.json');
    try {
      const dir = path.dirname(this._path);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this._path)) {
        const data = JSON.parse(fs.readFileSync(this._path, 'utf8')) as MemoryEntry[];
        this._entries = Array.isArray(data) ? data : [];
      }
    } catch {
      this._entries = [];
    }
    this.prune();
  }

  private _scheduleSave(): void {
    this._dirty = true;
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      if (this._dirty) this._saveSync();
    }, DEBOUNCE_MS);
  }

  private _saveSync(): void {
    this._dirty = false;
    try {
      fs.writeFileSync(this._path, JSON.stringify(this._entries, null, 2), 'utf8');
    } catch { /* silent */ }
  }

  save(): void {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    this._saveSync();
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
    this._scheduleSave();
    return true;
  }

  delete(key: string): void {
    this._entries = this._entries.filter(e => e.key !== key);
    this._scheduleSave();
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
    if (this._entries.length !== before) this._scheduleSave();
  }

  clear(): void {
    this._entries = [];
    this._scheduleSave();
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
        lines.push(`- ... and ${this._entries.length - lines.length} more entries`);
        break;
      }
      lines.push(line);
    }

    return `**AGNES remembers:**\n${lines.join('\n')}`;
  }
}
