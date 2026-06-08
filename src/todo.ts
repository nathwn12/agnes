import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  createdAt: number;
  updatedAt: number;
  category?: string;
}

const MAX_ITEMS = 10;
const MAX_CONTENT_LENGTH = 200;
const DEBOUNCE_MS = 500;
const COMPLETED_TTL_MS = 24 * 60 * 60 * 1000;

export class TodoStore {
  private _items: TodoItem[] = [];
  private _path: string = '';
  private _saveTimer: ReturnType<typeof setTimeout> | null = null;
  private _dirty = false;

  get itemCount(): number {
    return this._items.length;
  }

  load(worktreePath: string): void {
    this._path = path.join(worktreePath, '.agnes', 'todos.json');
    try {
      const dir = path.dirname(this._path);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this._path)) {
        const data = JSON.parse(fs.readFileSync(this._path, 'utf8')) as TodoItem[];
        this._items = Array.isArray(data) ? data : [];
      }
    } catch {
      this._items = [];
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
      fs.writeFileSync(this._path, JSON.stringify(this._items, null, 2), 'utf8');
    } catch { /* silent */ }
  }

  save(): void {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    this._saveSync();
  }

  create(content: string, category?: string): TodoItem {
    const truncated = content.slice(0, MAX_CONTENT_LENGTH);
    const item: TodoItem = {
      id: randomUUID(),
      content: truncated,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      category,
    };
    if (this._items.length >= MAX_ITEMS) {
      this._items.shift();
    }
    this._items.push(item);
    this._scheduleSave();
    return item;
  }

  update(id: string, partial: Partial<Pick<TodoItem, 'content' | 'status' | 'category'>>): TodoItem | null {
    const item = this._items.find(i => i.id === id);
    if (!item) return null;
    if (partial.content !== undefined) item.content = partial.content.slice(0, MAX_CONTENT_LENGTH);
    if (partial.status !== undefined) item.status = partial.status;
    if (partial.category !== undefined) item.category = partial.category;
    item.updatedAt = Date.now();
    this._scheduleSave();
    return item;
  }

  delete(id: string): void {
    this._items = this._items.filter(i => i.id !== id);
    this._scheduleSave();
  }

  list(status?: TodoItem['status'], category?: string): TodoItem[] {
    this.prune();
    let result = [...this._items];
    if (status) result = result.filter(i => i.status === status);
    if (category) result = result.filter(i => i.category === category);
    return result;
  }

  reorder(ids: string[]): boolean {
    const idSet = new Set(ids);
    if (ids.length !== this._items.length) return false;
    if (!this._items.every(i => idSet.has(i.id))) return false;
    const map = new Map(this._items.map(i => [i.id, i]));
    this._items = ids.map(id => map.get(id)!);
    this._scheduleSave();
    return true;
  }

  prune(): void {
    const now = Date.now();
    const before = this._items.length;
    this._items = this._items.filter(
      i => i.status !== 'completed' || now - i.updatedAt < COMPLETED_TTL_MS
    );
    if (this._items.length !== before) this._scheduleSave();
  }

  formatForPrompt(): string {
    this.prune();
    const active = this._items.filter(i => i.status !== 'completed');
    if (active.length === 0) return '';

    const lines = active.map(i => {
      const icon = i.status === 'in_progress' ? '🔄' : i.status === 'blocked' ? '🚫' : '⬜';
      const cat = i.category ? ` [${i.category}]` : '';
      return `${icon} ${i.id.slice(0, 8)}${cat}: ${i.content}`;
    });

    return `**Active tasks:**\n${lines.join('\n')}`;
  }
}
