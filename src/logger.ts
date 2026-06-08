import { getInstanceId } from './runtime.js';

const ENABLED = process.env.AGNES_DEBUG === '1' || process.env.AGNES_DEBUG === 'true';

function prefix(): string {
  return `[agnes:${getInstanceId()}]`;
}

function timestamp(): string {
  return new Date().toISOString();
}

export function info(message: string, err?: unknown): void {
  if (!ENABLED) return;
  const detail = err instanceof Error ? ` — ${err.message}` : err !== undefined ? ` — ${String(err)}` : '';
  console.error(`${prefix()} ${timestamp()} INFO ${message}${detail}`);
}

export function warn(message: string, err?: unknown): void {
  if (!ENABLED) return;
  const detail = err instanceof Error ? ` — ${err.message}` : err !== undefined ? ` — ${String(err)}` : '';
  console.error(`${prefix()} ${timestamp()} WARN ${message}${detail}`);
}

export function error(message: string, err?: unknown): void {
  if (!ENABLED) return;
  const detail = err instanceof Error ? ` — ${err.message}\n${err.stack}` : err !== undefined ? ` — ${String(err)}` : '';
  console.error(`${prefix()} ${timestamp()} ERROR ${message}${detail}`);
}
