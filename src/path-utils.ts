import * as fs from 'node:fs';

export class AgentNotFoundError extends Error {
  public readonly paths: string[];

  constructor(paths: string[]) {
    const msg = `Agent binary not found. Tried paths:\n  ${paths.join('\n  ')}`;
    super(msg);
    this.name = 'AgentNotFoundError';
    this.paths = paths;
  }
}

function resolveFromEnv(): string | null {
  const envOverride = process.env.AGNES_OPENCODE_BIN;
  if (envOverride && envOverride.trim().length > 0) {
    if (fs.existsSync(envOverride.trim())) {
      return envOverride.trim();
    }
  }
  return null;
}

const CANDIDATE_PATHS: string[] = [];

export function resolveAgentPath(preferredPaths?: string[]): string {
  const fromEnv = resolveFromEnv();
  if (fromEnv) return fromEnv;

  const candidates = preferredPaths ?? CANDIDATE_PATHS;
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  throw new AgentNotFoundError(candidates.length > 0 ? candidates : ['(no paths configured)']);
}
