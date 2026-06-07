// stderr logger with timestamps — every log call is now visible
const PREFIX = '[agnes]';

function timestamp(): string {
  return new Date().toISOString();
}

export function warn(message: string, err?: unknown): void {
  const detail = err instanceof Error ? ` — ${err.message}` : err !== undefined ? ` — ${String(err)}` : '';
  console.error(`${PREFIX} ${timestamp()} WARN ${message}${detail}`);
}

export function error(message: string, err?: unknown): void {
  const detail = err instanceof Error ? ` — ${err.message}\n${err.stack}` : err !== undefined ? ` — ${String(err)}` : '';
  console.error(`${PREFIX} ${timestamp()} ERROR ${message}${detail}`);
}