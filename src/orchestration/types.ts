export interface AgentDef {
  id: string;
  description: string;
  canWrite: boolean;
  canBash: boolean;
  terminal: boolean;
}

export interface DelegateTask {
  id: string;
  agent: string;
  description: string;
  prompt: string;
  parentSessionID: string;
  sessionID: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'timeout';
  result: string | null;
  error: string | null;
  createdAt: number;
  completedAt: number | null;
  depth: number;
  groupID?: string;
  noReply?: boolean;
}

export type DelegateMode = 'sync' | 'background';

export interface DelegateInput {
  agent: string;
  description: string;
  prompt: string;
  mode: DelegateMode;
  depth?: number;
  groupID?: string;
  noReply?: boolean;
}

export const DELEGATION_LIMITS = {
  MAX_DEPTH: 3,
  TERMINAL_DEPTH: 2,
} as const;

export const TERMINAL_AGENTS = new Set(['build', 'general']);

export const AGENTS: Record<string, AgentDef> = {
  explore: {
    id: 'explore',
    description: 'Read-only codebase exploration. Use for research, search, lookup, understanding existing code.',
    canWrite: false,
    canBash: false,
    terminal: true,
  },
  build: {
    id: 'build',
    description: 'File modification and implementation. Use for creating, editing, running commands. Has bash and write access.',
    canWrite: true,
    canBash: true,
    terminal: true,
  },
  plan: {
    id: 'plan',
    description: 'Architecture design and planning. Plans before implementation. Read-only.',
    canWrite: false,
    canBash: false,
    terminal: false,
  },
  'general': {
    id: 'general',
    description: 'General-purpose agent for verification, review, testing, and validation. Has bash access.',
    canWrite: false,
    canBash: true,
    terminal: true,
  },
};

export const TOOL_NAMES = {
  DELEGATE_TASK: 'delegate_task',
  GET_TASK_RESULT: 'get_task_result',
  CANCEL_TASK: 'cancel_task',
} as const;
