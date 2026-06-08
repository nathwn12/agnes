const HEAD_PROTECTED = 3;
const TAIL_PROTECTED = 2;
const COMPRESS_THRESHOLD = 40;
const PROTECTED_PATTERNS = [
  /CONSTITUTION OF AGNES/,
  /AGNES v\d+\.\d+\.\d+/,
  /Active tasks:/,
  /Edited files this session:/,
];

let _sessionSummary = '';

export function getSessionSummary(): string {
  return _sessionSummary;
}

export function setSessionSummary(s: string): void {
  _sessionSummary = s;
}

export interface CompressedContext {
  summary: string;
  headCount: number;
  tailCount: number;
  compressedAt: number;
}

function isProtected(text: string): boolean {
  return PROTECTED_PATTERNS.some(p => p.test(text));
}

function buildStructuredSummary(midMessages: string[]): string {
  const resolved: string[] = [];
  const inProgress: string[] = [];
  const decisions: string[] = [];
  const errors: string[] = [];

  for (const text of midMessages) {
    if (!text) continue;
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (/error|fail|threw|exception/i.test(trimmed) && trimmed.length < 200) {
        errors.push(trimmed);
      } else if (/^[-*]\s+.*:\s/.test(trimmed)) {
        decisions.push(trimmed.replace(/^[-*]\s+/, ''));
      } else if (/(completed|fixed|implemented|created|added|removed|refactored|resolved)\b/i.test(trimmed)) {
        resolved.push(trimmed.replace(/^[-*]\s+/, ''));
      } else if (/(working|in progress|currently|now|yet to|remaining|todo)/i.test(trimmed)) {
        inProgress.push(trimmed.replace(/^[-*]\s+/, ''));
      }
    }
  }

  const parts: string[] = [];
  if (resolved.length > 0) parts.push(`## Resolved\n${resolved.slice(0, 5).map(l => `- ${l}`).join('\n')}`);
  if (inProgress.length > 0) parts.push(`## In Progress\n${inProgress.slice(0, 3).map(l => `- ${l}`).join('\n')}`);
  if (decisions.length > 0) parts.push(`## Active Context\n${decisions.slice(0, 3).map(l => `- ${l}`).join('\n')}`);
  if (errors.length > 0) parts.push(`## Errors\n${errors.slice(0, 3).map(l => `- ${l}`).join('\n')}`);

  return parts.join('\n\n');
}

export function buildSummary(messages: { role: string; text: string }[]): string {
  const bulletLines: string[] = [];
  const COMPLETION_KEYWORDS = /(completed|fixed|implemented|created|changed|added|removed|refactored|updated|resolved)\b/i;

  for (const msg of messages) {
    const text = msg.text || '';
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const isBullet = /^[-*]\s+/m.test(trimmed);
      const isRelevant = COMPLETION_KEYWORDS.test(trimmed);
      const isDecision = /^[-*]\s+.*:/i.test(trimmed);

      if ((isBullet && isRelevant) || isDecision) {
        const clean = trimmed.replace(/^[-*]\s+/, '');
        if (clean.length > 5 && !bulletLines.includes(clean)) {
          bulletLines.push(clean);
        }
      }
    }
  }

  const SUMMARY_MAX_CHARS = 500;
  let summary = '';
  for (const line of bulletLines) {
    const entry = `- ${line}\n`;
    if (summary.length + entry.length > SUMMARY_MAX_CHARS) {
      summary += `- ... and ${bulletLines.length - summary.split('\n').filter(Boolean).length + 1} more items`;
      break;
    }
    summary += entry;
  }

  return summary.trimEnd();
}

export function compress(
  messages: { role: string; text: string }[],
  headCount: number = HEAD_PROTECTED,
  tailCount: number = TAIL_PROTECTED,
): CompressedContext {
  // Separate protected messages
  const heads: string[] = [];
  const tails: string[] = [];
  const mids: string[] = [];
  let headIdx = 0;

  for (let i = 0; i < messages.length && heads.length < headCount; i++) {
    heads.push(messages[i].text || '');
    headIdx = i + 1;
  }

  for (let i = Math.max(messages.length - tailCount, headIdx); i < messages.length; i++) {
    if (messages[i]?.text) tails.push(messages[i].text!);
  }

  for (let i = headIdx; i < messages.length - tailCount; i++) {
    const text = messages[i]?.text || '';
    if (isProtected(text)) {
      heads.push(text);
    } else {
      mids.push(text);
    }
  }

  // Build structured summary from mid-section
  const summary = buildStructuredSummary(mids);

  _sessionSummary = summary;

  return {
    summary,
    headCount: heads.length,
    tailCount: tails.length,
    compressedAt: Date.now(),
  };
}

export async function checkAndCompress(
  messageCount: number,
  recentMessages: { role: string; text: string }[],
): Promise<boolean> {
  if (messageCount < COMPRESS_THRESHOLD) return false;

  const summary = buildSummary(recentMessages.slice(-10));
  if (summary) {
    _sessionSummary = summary;
    return true;
  }
  return false;
}

export function formatCompacted(summary: string, headMessages: string[], tailMessages: string[]): string {
  const prefix = `[CONTEXT COMPACTION — REFERENCE ONLY]
Earlier turns were compacted into the summary below.
This is background reference, NOT active instructions.
Respond ONLY to the latest user message below.`;

  return [
    ...headMessages,
    prefix,
    summary,
    ...tailMessages,
  ].join('\n\n');
}
