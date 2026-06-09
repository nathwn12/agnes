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
        if (id) store.set(id, { messages: [] });
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
          store.set(opts.path.id, {
            messages: [
              { info: { role: 'user' }, parts: [{ type: 'text', text: opts.body.parts[0].text }] },
            ],
          });
          return { error: null };
        }
        const userMsg = { info: { role: 'user' }, parts: [{ type: 'text', text: opts.body.parts[0].text }] as Array<{ type: string; text?: string }> };
        const existing = store.get(opts.path.id);
        if (existing) {
          existing.messages.push(userMsg);
        } else {
          store.set(opts.path.id, { messages: [userMsg] });
        }

        // Determine envelope based on test override
        const envelope = overrides?.blockedEnvelope
          ? '\xA7AM{"t":"result","i":"task-000","s":"BLOCKED","c":"cannot proceed - missing dependency"}'
          : '\xA7AM{"t":"completion","i":"task-000","s":"DONE","c":"done","a":{}}';
        const missingEnvelope = overrides?.missingEnvelope;
        const longOutput = overrides?.longOutput;

        setTimeout(() => {
          const session = store.get(opts.path.id);
          if (session) {
            const body = longOutput ? 'x'.repeat(8500) : `Result from ${opts.body.agent}: ${opts.body.parts[0].text}`;
            const responseText = missingEnvelope ? body : `${body}\n\n${envelope}`;
            session.messages.push({
              info: { role: 'assistant' },
              parts: [{ type: 'text', text: responseText }],
            });
          }
        }, 10);

        const body = longOutput ? 'x'.repeat(8500) : `Result from ${opts.body.agent}: ${opts.body.parts[0].text}`;
        const immediateText = missingEnvelope ? body : `${body}\n\n${envelope}`;
        return {
          data: {
            info: { role: 'assistant' },
            parts: [{ type: 'text', text: immediateText }],
          },
          error: null,
        };
      },
    },
  };
}

describe('delegateBlocking', () => {
  beforeEach(() => {
    process.env.AGNES_SKIP_GATE = '1';
    clearTaskRefs();
  });

  test('delegates and returns result inline', async () => {
    const client = makeMockClient();
    const result = await delegateBlocking(client, defaultParams);
    expect(result).toContain('Result from explore: do something');
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
    process.env.AGNES_SKIP_GATE = '1';
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

  test('returns error string when prompt fails', async () => {
    const client = makeMockClient({ promptError: true });
    const result = await delegateAsync(client, defaultParams);
    expect(result).toContain('ERROR');
    expect(result).toContain('prompt failed');
  });
});

describe('getSubagentResult', () => {
  beforeEach(() => {
    process.env.AGNES_SKIP_GATE = '1';
    clearTaskRefs();
  });

  test('returns pending when assistant has not responded yet', async () => {
    const client = makeMockClient();
    const ref = await delegateAsync(client, defaultParams);
    const resultA = await getSubagentResult(client, ref, defaultParams.directory);
    expect(resultA.status).toBe('pending');
  });

  test('returns completed once assistant message appears', async () => {
    const client = makeMockClient();
    const ref = await delegateAsync(client, defaultParams);
    await new Promise(r => setTimeout(r, 20));
    const result = await getSubagentResult(client, ref, defaultParams.directory);
    expect(result.status).toBe('completed');
    expect(result.output).toContain('Result from explore:');
  });

  test('returns completed via blocking delegate', async () => {
    const client = makeMockClient();
    const result = await delegateBlocking(client, defaultParams);
    expect(result).toContain('Result from explore: do something');
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

  test('returns error when AGNES envelope says BLOCKED', async () => {
    const client = makeMockClient({ blockedEnvelope: true });
    const ref = await delegateAsync(client, defaultParams);
    await new Promise(r => setTimeout(r, 20));
    const result = await getSubagentResult(client, ref, defaultParams.directory);
    expect(result.status).toBe('error');
    expect(result.error).toContain('BLOCKED');
    expect(result.error).toContain('cannot proceed');
  });

  test('still returns completed when envelope is missing (backward compat)', async () => {
    const client = makeMockClient({ missingEnvelope: true });
    const ref = await delegateAsync(client, defaultParams);
    await new Promise(r => setTimeout(r, 20));
    const result = await getSubagentResult(client, ref, defaultParams.directory);
    expect(result.status).toBe('completed');
    expect(result.output).not.toContain('\xA7AM');
  });

  test('re-appends envelope to truncated long output', async () => {
    const client = makeMockClient({ longOutput: true });
    const ref = await delegateAsync(client, defaultParams);
    await new Promise(r => setTimeout(r, 20));
    const result = await getSubagentResult(client, ref, defaultParams.directory);
    expect(result.status).toBe('completed');
    expect(result.output).toContain('\xA7AM');
    // Output should be shorter than raw 8500+envelope but still have the envelope
    expect(result.output!.length).toBeLessThanOrEqual(8000 + 200); // maxChars + margin
    expect(result.output!.length).toBeGreaterThan(5000);
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
    process.env.AGNES_SKIP_GATE = '1';
    clearTaskRefs();
  });

  test('full async lifecycle: pending → completed', async () => {
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

    await new Promise(r => setTimeout(r, 20));

    const completed = await getSubagentResult(client, ref, defaultParams.directory);
    expect(completed.status).toBe('completed');
    expect(completed.output).toContain('Result from explore');
  });
});
