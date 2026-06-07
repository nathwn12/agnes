import { describe, expect, test, beforeEach } from 'bun:test';
import {
  delegateBlocking,
  delegateAsync,
  getSubagentResult,
  recordTaskRef,
  lookupTaskRef,
  clearTaskRefs,
} from './delegate.js';

const defaultParams = {
  agent: 'explore',
  description: 'test task',
  prompt: 'do something',
  sessionID: 'ses_parent_001',
  directory: '/tmp/test',
};

function makeMockClient(overrides?: Record<string, unknown>) {
  const store = new Map<string, { messages: Array<{ info: { role: string }; parts: Array<{ type: string; text?: string }> }> }>();

  return {
    session: {
      create: async (_opts: { body?: { title?: string } }) => {
        const id = overrides?.createError ? undefined : `ses_child_${Date.now()}`;
        const error = overrides?.createError ? { status: 400, message: 'create failed' } : null;
        return { data: id ? { id } : undefined, error };
      },
      get: async (opts: { path: { id: string } }) => {
        if (overrides?.getError) {
          return { data: undefined, error: { status: 500, message: 'get failed' } };
        }
        const exists = store.has(opts.path.id) || !overrides?.sessionNotFound;
        if (!exists) {
          return { data: undefined, error: { status: 404 } };
        }
        return { data: { id: opts.path.id, summary: {} }, error: null };
      },
      messages: async (opts: { path: { id: string } }) => {
        if (overrides?.messagesError) {
          return { data: undefined, error: { status: 500, message: 'messages failed' } };
        }
        const session = store.get(opts.path.id);
        return { data: session?.messages ?? [], error: null };
      },
      prompt: async (opts: { path: { id: string }; body: { agent?: string; noReply?: boolean; parts: Array<{ type: string; text: string }> } }) => {
        if (overrides?.promptError && !opts.body.noReply) {
          return { data: undefined, error: { status: 500, message: 'prompt failed' } };
        }
        if (opts.body.noReply) {
          if (overrides?.promptNoReplyError) {
            return { error: { status: 500, message: 'noReply prompt failed' } };
          }
          store.set(opts.path.id, {
            messages: [
              { info: { role: 'user' }, parts: [{ type: 'text', text: opts.body.parts[0].text }] },
            ],
          });
          return { error: null };
        }
        const response = {
          data: {
            info: { role: 'assistant' },
            parts: [
              { type: 'text', text: `Result from ${opts.body.agent}: ${opts.body.parts[0].text}` },
            ],
          },
          error: null,
        };
        store.set(opts.path.id, {
          messages: [
            { info: { role: 'user' }, parts: [{ type: 'text', text: opts.body.parts[0].text }] },
            { info: { role: 'assistant' }, parts: [{ type: 'text', text: `Result from ${opts.body.agent}: ${opts.body.parts[0].text}` }] },
          ],
        });
        return response;
      },
    },
  };
}

describe('delegateBlocking', () => {
  beforeEach(() => {
    clearTaskRefs();
  });

  test('delegates and returns result inline', async () => {
    const client = makeMockClient();
    const result = await delegateBlocking(client, defaultParams);
    expect(result).toBe('Result from explore: do something');
  });

  test('returns error string when session creation fails', async () => {
    const client = makeMockClient({ createError: true });
    const result = await delegateBlocking(client, defaultParams);
    expect(result).toContain('ERROR');
    expect(result).toContain('create failed');
  });

  test('returns error string when prompt fails', async () => {
    const client = makeMockClient({ promptError: true });
    const result = await delegateBlocking(client, defaultParams);
    expect(result).toContain('ERROR');
    expect(result).toContain('prompt failed');
  });
});

describe('delegateAsync', () => {
  beforeEach(() => {
    clearTaskRefs();
  });

  test('returns session ID for async delegation', async () => {
    const client = makeMockClient();
    const ref = await delegateAsync(client, defaultParams);
    expect(ref).toMatch(/^ses_child_/);
  });

  test('returns error string when session creation fails', async () => {
    const client = makeMockClient({ createError: true });
    const result = await delegateAsync(client, defaultParams);
    expect(result).toContain('ERROR');
    expect(result).toContain('create failed');
  });

  test('returns error string when noReply prompt fails', async () => {
    const client = makeMockClient({ promptNoReplyError: true });
    const result = await delegateAsync(client, defaultParams);
    expect(result).toContain('ERROR');
    expect(result).toContain('async delegation failed');
  });
});

describe('getSubagentResult', () => {
  beforeEach(() => {
    clearTaskRefs();
  });

  test('returns pending when no messages yet', async () => {
    const client = makeMockClient();
    const ref = await delegateAsync(client, defaultParams);
    const resultA = await getSubagentResult(client, ref, defaultParams.directory);
    expect(resultA.status).toBe('pending');
  });

  test('returns completed when assistant message exists', async () => {
    const client = makeMockClient();
    const result = await delegateBlocking(client, defaultParams);
    expect(result).toBe('Result from explore: do something');
  });

  test('returns not_found for unknown session', async () => {
    const client = makeMockClient({ sessionNotFound: true });
    const result = await getSubagentResult(client, 'ses_nonexistent', defaultParams.directory);
    expect(result.status).toBe('not_found');
  });

  test('returns error when session.get fails', async () => {
    const client = makeMockClient({ getError: true });
    const result = await getSubagentResult(client, 'ses_error', defaultParams.directory);
    expect(result.status).toBe('error');
  });

  test('returns error when messages fetch fails', async () => {
    const client = makeMockClient({ messagesError: true });
    const result = await getSubagentResult(client, 'ses_error', defaultParams.directory);
    expect(result.status).toBe('error');
  });
});

describe('taskRef store', () => {
  beforeEach(() => {
    clearTaskRefs();
  });

  test('records and looks up task refs', () => {
    recordTaskRef('ses_child_001', {
      sessionID: 'ses_child_001',
      directory: '/tmp',
      agent: 'explore',
      description: 'test',
    });
    const info = lookupTaskRef('ses_child_001');
    expect(info).not.toBeUndefined();
    expect(info!.sessionID).toBe('ses_child_001');
    expect(info!.agent).toBe('explore');
  });

  test('returns undefined for unknown refs', () => {
    expect(lookupTaskRef('ses_unknown')).toBeUndefined();
  });

  test('clearTaskRefs empties the store', () => {
    recordTaskRef('ses_001', { sessionID: 'ses_001', directory: '/tmp', agent: 'explore', description: 't' });
    clearTaskRefs();
    expect(lookupTaskRef('ses_001')).toBeUndefined();
  });
});

describe('integration: async delegate then get result', () => {
  beforeEach(() => {
    clearTaskRefs();
  });

  test('full async lifecycle', async () => {
    const client = makeMockClient();
    const ref = await delegateAsync(client, defaultParams);
    expect(ref).toMatch(/^ses_child_/);

    recordTaskRef(ref, {
      sessionID: ref,
      directory: defaultParams.directory,
      agent: defaultParams.agent,
      description: defaultParams.description,
    });

    const pending = await getSubagentResult(client, ref, defaultParams.directory);
    expect(pending.status).toBe('pending');

    const blockingResult = await delegateBlocking(client, defaultParams);
    expect(blockingResult).toContain('Result from explore');

    const completed = await getSubagentResult(client, ref, defaultParams.directory);
    expect(completed.status).toBe('completed');
    expect(completed.output).toContain('Result from explore');
  });
});
