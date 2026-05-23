import { detectShell } from './shell.js';
import type { Gate, GateResult } from './verification.js';

let _lastOutput = '';

export function setLastOutput(output: string): void {
  _lastOutput = output;
}

function getOutput(): string {
  return _lastOutput || process.env.AGNES_LAST_OUTPUT || '';
}

export function checkShellMismatch(output: string): GateResult {
  const env = detectShell();
  const errors: string[] = [];

  if (env.shellType === 'powershell' || env.shellType === 'cmd') {
    return {
      gateId: 'shell-mismatch',
      status: 'PASS',
      evidence: { errors, command: 'scan-shell-mismatch', exitCode: 0 },
      timestamp: new Date().toISOString(),
      durationMs: 0,
    };
  }

  if (env.shellType === 'git-bash' || env.shellType === 'wsl' || env.shellType === 'unix' || env.shellType === 'unknown') {
    for (const pattern of env.antiPatterns) {
      if (output.includes(pattern)) {
        errors.push(`Found PowerShell anti-pattern "${pattern}" in output while running on ${env.shellType}`);
      }
    }
  }

  return {
    gateId: 'shell-mismatch',
    status: 'PASS',
    evidence: {
      errors,
      command: 'scan-shell-mismatch',
      exitCode: 0,
      output: errors.length > 0 ? `Found ${errors.length} shell mismatch(es)` : undefined,
    },
    timestamp: new Date().toISOString(),
    durationMs: 0,
  };
}

export const shellMismatchGate: Gate = {
  id: 'shell-mismatch',
  name: 'Shell Mismatch Detector',
  description: 'Scans subagent output for PowerShell commands when running on Git Bash',
  isBlocking: false,
  run: async () => {
    const start = Date.now();
    const result = checkShellMismatch(getOutput());
    return {
      ...result,
      durationMs: Date.now() - start,
    };
  },
};
