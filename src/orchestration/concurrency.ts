// Per-agent concurrency control with slot tracking

interface AgentSlots {
  limit: number;
  active: number;
}

const DEFAULT_LIMITS: Record<string, number> = {
  explore: 3,
  build: 5,
  plan: 2,
  general: 5,
};

const slots = new Map<string, AgentSlots>();

function ensureAgent(agent: string): AgentSlots {
  let s = slots.get(agent);
  if (!s) {
    s = { limit: DEFAULT_LIMITS[agent] ?? 3, active: 0 };
    slots.set(agent, s);
  }
  return s;
}

export function setConcurrencyLimit(agent: string, limit: number): void {
  ensureAgent(agent).limit = limit;
}

export function getConcurrencyLimit(agent: string): number {
  return ensureAgent(agent).limit;
}

export function getActiveCount(agent: string): number {
  return ensureAgent(agent).active;
}

export function tryAcquire(agent: string): boolean {
  const s = ensureAgent(agent);
  if (s.active >= s.limit) return false;
  s.active++;
  return true;
}

export function release(agent: string): void {
  const s = ensureAgent(agent);
  if (s.active > 0) s.active--;
}

export function getConcurrencyStats(): Record<string, { limit: number; active: number }> {
  const stats: Record<string, { limit: number; active: number }> = {};
  for (const [agent, s] of slots) {
    stats[agent] = { limit: s.limit, active: s.active };
  }
  return stats;
}
