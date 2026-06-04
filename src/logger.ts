const PREFIX = '[agnes]';

function formatMessage(level: string, message: string): string {
  return `${PREFIX} [${level}] ${new Date().toISOString()} ${message}\n`;
}

function formatError(err: unknown): string {
  if (err === undefined) return '';
  if (err instanceof Error) return `: ${err.name}: ${err.message}`;
  if (typeof err === 'string') return `: ${err}`;
  try {
    return `: ${JSON.stringify(err)}`;
  } catch {
    return ': [unserializable error]';
  }
}

export function debug(message: string): void {
  process.stderr.write(formatMessage('debug', message));
}

export function info(message: string): void {
  process.stderr.write(formatMessage('info', message));
}

export function warn(message: string, err?: unknown): void {
  process.stderr.write(formatMessage('warn', message + formatError(err)));
}

export function error(message: string, err?: unknown): void {
  process.stderr.write(formatMessage('error', message + formatError(err)));
}
