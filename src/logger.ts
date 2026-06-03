const PREFIX = '[agnes]';

function formatMessage(level: string, message: string): string {
  return `${PREFIX} [${level}] ${new Date().toISOString()} ${message}\n`;
}

export function debug(message: string): void {
  process.stderr.write(formatMessage('debug', message));
}

export function info(message: string): void {
  process.stderr.write(formatMessage('info', message));
}

export function warn(message: string, err?: unknown): void {
  let text = message;
  if (err) {
    text += err instanceof Error ? ` — ${err.message}` : ` — ${String(err)}`;
  }
  process.stderr.write(formatMessage('warn', text));
}

export function error(message: string, err?: unknown): void {
  let text = message;
  if (err) {
    text += err instanceof Error ? ` — ${err.message}` : ` — ${String(err)}`;
  }
  process.stderr.write(formatMessage('error', text));
}
