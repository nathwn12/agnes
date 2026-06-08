let _sessionSummary = '';

export function getSessionSummary(): string {
  return _sessionSummary;
}

export function setSessionSummary(s: string): void {
  _sessionSummary = s;
}
