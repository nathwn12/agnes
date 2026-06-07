// stderr logger — SILENT by default. Set AGNES_DEBUG=1 to enable.
const PREFIX = '[agnes]';
const ENABLED = process.env.AGNES_DEBUG === '1' || process.env.AGNES_DEBUG === 'true';

function timestamp(): string {
  return new Date().toISOString();
}

export function warn(message: string, err?: unknown): void {
  if (!ENABLED) return;
  const detail = err instanceof Error ? ` — ${err.message}` : err !== undefined ? ` — ${String(err)}` : '';
  console.error(`${PREFIX} ${timestamp()} WARN ${message}${detail}`);
}

export function error(message: string, err?: unknown): void {
  if (!ENABLED) return;
  const detail = err instanceof Error ? ` — ${err.message}\n${err.stack}` : err !== undefined ? ` — ${String(err)}` : '';
  console.error(`${PREFIX} ${timestamp()} ERROR ${message}${detail}`);
}