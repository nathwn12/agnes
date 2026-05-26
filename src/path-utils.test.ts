import { describe, it, expect } from 'bun:test';
import { resolveAgentPath, AgentNotFoundError } from './path-utils.js';

describe('resolveAgentPath', () => {
  it('throws AgentNotFoundError when no paths configured', () => {
    try {
      resolveAgentPath([]);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AgentNotFoundError);
      expect((err as AgentNotFoundError).paths).toEqual(['(no paths configured)']);
      expect((err as AgentNotFoundError).message).toContain('Agent binary not found');
    }
  });

  it('throws AgentNotFoundError when binary missing at all paths', () => {
    try {
      resolveAgentPath(['/nonexistent/path/binary.exe', '/another/missing']);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AgentNotFoundError);
      const agentErr = err as AgentNotFoundError;
      expect(agentErr.paths).toContain('/nonexistent/path/binary.exe');
      expect(agentErr.paths).toContain('/another/missing');
      expect(agentErr.message).toContain('Agent binary not found');
    }
  });

  it('returns path when env var overrides and exists', () => {
    process.env.AGNES_OPENCODE_BIN = process.execPath;
    try {
      const result = resolveAgentPath([]);
      expect(result).toBe(process.execPath);
    } finally {
      delete process.env.AGNES_OPENCODE_BIN;
    }
  });
});
