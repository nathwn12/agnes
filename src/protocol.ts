import { randomUUID } from 'node:crypto';
import { TaskMessageSchema, ResultMessageSchema, BaseMessageSchema } from './schema.js';

export type MessageType = 'task' | 'result' | 'error' | 'status' | 'completion';
export type CompletionStatus = 'DONE' | 'DONE_WITH_CONCERNS' | 'NEEDS_CONTEXT' | 'BLOCKED';

interface AgnesMessage {
  type: MessageType;
  id: string;
  timestamp: string;
}

export interface TaskMessage extends AgnesMessage {
  type: 'task';
  skill: string;
  payload: unknown;
  config?: {
    tags?: string[];
    metadata?: Record<string, unknown>;
    maxDurationMs?: number;
  };
}

export interface ResultMessage extends AgnesMessage {
  type: 'result';
  taskId: string;
  status: CompletionStatus;
  content: string;
  artifact?: unknown;
  metrics?: {
    durationMs: number;
    filesChanged?: number;
    tokenCount?: number;
  };
}

export interface ErrorMessage extends AgnesMessage {
  type: 'error';
  taskId: string;
  errorType: string;
  detail: string;
  stack?: string;
}

export interface StatusMessage extends AgnesMessage {
  type: 'status';
  taskId: string;
  phase: string;
  progress?: { current: number; total: number };
}

export interface CompletionMessage extends AgnesMessage {
  type: 'completion';
  status: CompletionStatus;
  summary: string;
}

export type AnyAgnesMessage =
  | TaskMessage
  | ResultMessage
  | ErrorMessage
  | StatusMessage
  | CompletionMessage;

const VALID_TYPES: ReadonlySet<string> = new Set([
  'task',
  'result',
  'error',
  'status',
  'completion',
]);

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenceStart = trimmed.match(/^```(?:json)?\s*\n/);
  const fenceEnd = trimmed.match(/\n```\s*$/);
  if (fenceStart && fenceEnd) {
    return trimmed.slice(fenceStart[0].length, -fenceEnd[0].length).trim();
  }
  return trimmed;
}

function findJsonInText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const firstBrace = trimmed.indexOf('{');
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = firstBrace; i < trimmed.length; i++) {
    const ch = trimmed[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"' && !escape) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth === 0) {
        return trimmed.slice(firstBrace, i + 1);
      }
    }
  }

  return null;
}

function validCompletionStatus(s: unknown): s is CompletionStatus {
  return s === 'DONE' || s === 'DONE_WITH_CONCERNS' || s === 'NEEDS_CONTEXT' || s === 'BLOCKED';
}

const REQUIRED_FIELDS: Record<string, Record<string, string>> = {
  task: { skill: 'string' },
  result: { taskId: 'string', status: 'string', content: 'string' },
  error: { taskId: 'string', errorType: 'string', detail: 'string' },
  status: { taskId: 'string', phase: 'string' },
  completion: { status: 'string', summary: 'string' },
};

export function parseAgnesMessage(text: string): AnyAgnesMessage | null {
  // Strip HTML comments — <agnes:message> wrappers should be invisible to users
  const noComments = text.replace(/<!--[\s\S]*?-->/g, '');
  const cleaned = stripCodeFences(noComments);
  const jsonCandidate = findJsonInText(cleaned);
  if (!jsonCandidate) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  // Strict path: validate against Zod schemas
  if (obj.schema === 'agnes/message-v1') {
    try {
      if (obj.type === 'task') return TaskMessageSchema.parse(obj) as unknown as AnyAgnesMessage;
      if (obj.type === 'result') return ResultMessageSchema.parse(obj) as unknown as AnyAgnesMessage;
      return BaseMessageSchema.parse(obj) as unknown as AnyAgnesMessage;
    } catch {
      return null;
    }
  }

  if (typeof obj.type !== 'string' || !VALID_TYPES.has(obj.type)) return null;

  if (typeof obj.id !== 'string') return null;
  if (typeof obj.timestamp !== 'string') return null;

  const type = obj.type;
  const required = REQUIRED_FIELDS[type];
  if (required) {
    for (const [field, expectedType] of Object.entries(required)) {
      if (typeof obj[field] !== expectedType) return null;
    }
    if (type === 'completion' || type === 'result') {
      if (!validCompletionStatus(obj.status)) return null;
    }
  }

  if (isValidAgnesMessage(obj)) {
    return obj;
  }
  return null;
}

export function isValidAgnesMessage(obj: unknown): obj is AnyAgnesMessage {
  if (!obj || typeof obj !== 'object') return false;
  const msg = obj as Record<string, unknown>;
  if (typeof msg.type !== 'string' || !VALID_TYPES.has(msg.type)) return false;
  if (typeof msg.id !== 'string') return false;
  if (typeof msg.timestamp !== 'string') return false;

  const type = msg.type;
  const required = REQUIRED_FIELDS[type];
  if (required) {
    for (const [field, expectedType] of Object.entries(required)) {
      if (typeof msg[field] !== expectedType) return false;
    }
    if (type === 'completion' || type === 'result') {
      if (!validCompletionStatus(msg.status)) return false;
    }
  }

  return true;
}

export function serializeAgnesMessage(msg: object): string {
  const m = msg as Record<string, unknown>;
  const enhanced = {
    ...m,
    schema: 'agnes/message-v1',
    id: m.id ?? randomUUID(),
    timestamp: m.timestamp ?? new Date().toISOString(),
  };
  const json = JSON.stringify(enhanced);
  return `<agnes:message>${json}</agnes:message>`;
}

export function generateMessageId(): string {
  return randomUUID();
}

export function buildResultMessage(params: {
  status: CompletionStatus;
  summary: string;
  reasoning?: string;
}): string {
  return serializeAgnesMessage({
    type: 'result',
    status: params.status,
    summary: params.summary,
    reasoning_content: params.reasoning,
  });
}

export function buildTaskMessage(params: {
  goal: string;
  files?: string[];
  constraints?: { no_shared_edits?: boolean; read_only?: boolean };
}): string {
  return serializeAgnesMessage({
    type: 'task',
    goal: params.goal,
    files: params.files || [],
    constraints: params.constraints || { no_shared_edits: true },
  });
}

// ── Protocol Shells ─────────────────────────────────────────────────────────

export interface ProtocolOperation {
  operation: string;
  params: Record<string, string>;
}

export interface ProtocolShell {
  intent: string;
  input: Record<string, string>;
  process: ProtocolOperation[];
  output: Record<string, string>;
}

export interface ProtocolShellParseError {
  error: string;
  input: string;
}

export function formatProtocolShell(ps: ProtocolShell): string {
  const processLines = ps.process.map(op => {
    const paramsStr = Object.entries(op.params)
      .map(([k, v]) => `${k}="${v}"`)
      .join(', ');
    return `    /${op.operation}{${paramsStr}}`;
  }).join(',\n');

  return [
    `/protocol {`,
    `  intent="${ps.intent}"`,
    `  input={${Object.entries(ps.input).map(([k, v]) => `${k}="${v}"`).join(', ')}}`,
    `  process=[`,
    processLines,
    `  ],`,
    `  output={${Object.entries(ps.output).map(([k, v]) => `${k}="${v}"`).join(', ')}}`,
    `}`,
  ].join('\n');
}

export function parseProtocolShell(input: string): ProtocolShell | ProtocolShellParseError {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/protocol')) {
    return { error: 'Must start with /protocol', input };
  }

  const intentMatch = trimmed.match(/intent="([^"]+)"/);
  if (!intentMatch) {
    return { error: 'Missing required intent field', input };
  }

  const inputMatch = trimmed.match(/input=\{(.+?)\}/);
  const outputMatch = trimmed.match(/output=\{(.+?)\}/);

  const parseFields = (raw: string | undefined): Record<string, string> => {
    if (!raw) return {};
    const result: Record<string, string> = {};
    const re = /(\w+)="([^"]*)"/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
      result[m[1]] = m[2];
    }
    return result;
  };

  const process: ProtocolOperation[] = [];
  const opRe = /\/(\w+)\{([^}]*)\}/g;
  let opMatch;
  while ((opMatch = opRe.exec(trimmed)) !== null) {
    const opName = opMatch[1];
    if (opName === 'protocol') continue;
    process.push({
      operation: opName,
      params: parseFields(opMatch[2]),
    });
  }

  return {
    intent: intentMatch[1],
    input: parseFields(inputMatch ? inputMatch[1] : undefined),
    process,
    output: parseFields(outputMatch ? outputMatch[1] : undefined),
  };
}

// ── Cognitive Tools ─────────────────────────────────────────────────────────

export type CognitiveToolId =
  | 'decompose'
  | 'verify'
  | 'compare'
  | 'abstract'
  | 'synthesize'
  | 'reflect'
  | 'trace';

export interface CognitiveTool {
  id: CognitiveToolId;
  intent: string;
  inputFields: string[];
  outputDescription: string;
  promptTemplate: string;
}

export const COGNITIVE_TOOLS: Record<CognitiveToolId, CognitiveTool> = {
  decompose: {
    id: 'decompose',
    intent: 'Break a problem into independent sub-problems',
    inputFields: ['problem', 'constraints'],
    outputDescription: 'ordered list of sub-problems with independence claim',
    promptTemplate: `Given this problem and constraints, break it into the smallest independent sub-problems that can be solved separately. For each: name, scope, independence proof, and estimated complexity.`,
  },
  verify: {
    id: 'verify',
    intent: 'Check output against a set of criteria with evidence',
    inputFields: ['output', 'criteria'],
    outputDescription: 'pass/fail per criterion with specific evidence',
    promptTemplate: `Check the output against each criterion. For each: pass or fail, specific evidence from the output, and a confidence level (high/medium/low).`,
  },
  compare: {
    id: 'compare',
    intent: 'Evaluate alternative solutions systematically',
    inputFields: ['options', 'criteria'],
    outputDescription: 'ranked alternatives with per-criterion score and reasoning',
    promptTemplate: `Compare the options against each criterion. Score each 0-10. Provide per-criterion reasoning. Rank with aggregate score and explain the tiebreaker logic.`,
  },
  abstract: {
    id: 'abstract',
    intent: 'Extract general patterns from specific instances',
    inputFields: ['specifics', 'domain'],
    outputDescription: 'generalized patterns with structural essence',
    promptTemplate: `What patterns generalize across these specifics? Ignore surface differences. Extract the underlying structure. Name each pattern, describe its invariant properties, and give one counterexample that breaks it.`,
  },
  synthesize: {
    id: 'synthesize',
    intent: 'Combine findings into a coherent integrated conclusion',
    inputFields: ['findings', 'goal'],
    outputDescription: 'integrated conclusion with contradiction resolution',
    promptTemplate: `Combine the following findings into a conclusion that serves the goal. Resolve contradictions explicitly. Fill knowledge gaps with labeled assumptions. Flag confidence per claim.`,
  },
  reflect: {
    id: 'reflect',
    intent: 'Self-critique and produce an improved output',
    inputFields: ['draft', 'criteria'],
    outputDescription: 'improved draft with a change log explaining what changed and why',
    promptTemplate: `Critique the draft against each criterion. Identify 3 weakest points. Produce an improved version addressing each weakness. End with a change log: what changed, why, and what tradeoffs were accepted.`,
  },
  trace: {
    id: 'trace',
    intent: 'Walk through a process step-by-step to find the root cause',
    inputFields: ['process_description', 'failure_observation'],
    outputDescription: 'step-by-step trace with root cause hypothesis at each decision point',
    promptTemplate: `Walk through the process from start to the failure point. At each step: what was expected, what actually happened, and what branch was taken. When the path diverges from expected, flag it. Produce root cause hypothesis with supporting evidence chain.`,
  },
};

export function getCognitiveTool(id: string): CognitiveTool | null {
  const tool = COGNITIVE_TOOLS[id as CognitiveToolId];
  return tool || null;
}

export function formatCognitiveToolInvocation(toolId: CognitiveToolId, inputs: Record<string, string>): string {
  const tool = COGNITIVE_TOOLS[toolId];
  if (!tool) return '';
  const inputStr = Object.entries(inputs)
    .map(([k, v]) => `  ${k}="${v.replace(/"/g, '\\"')}"`)
    .join('\n');
  return [
    `/cognitive ${toolId} {`,
    `  intent="${tool.intent}"`,
    inputStr,
    `}`,
  ].join('\n');
}

export function findCognitiveToolCalls(text: string): Array<{ toolId: CognitiveToolId; inputs: Record<string, string> }> {
  const calls: Array<{ toolId: CognitiveToolId; inputs: Record<string, string> }> = [];
  const re = /\/cognitive\s+(\w+)\s*\{([^}]*)\}/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const toolId = match[1] as CognitiveToolId;
    if (!COGNITIVE_TOOLS[toolId]) continue;
    const inputRe = /(\w+)="([^"]*)"/g;
    const inputs: Record<string, string> = {};
    let im;
    while ((im = inputRe.exec(match[2])) !== null) {
      inputs[im[1]] = im[2];
    }
    calls.push({ toolId, inputs });
  }
  return calls;
}
