import * as logger from './logger.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MinimalClient = any;

export interface DelegateParams {
  agent: string;
  description: string;
  prompt: string;
  sessionID: string;
  directory: string;
}

export interface SubagentResult {
  status: 'pending' | 'completed' | 'error' | 'not_found';
  output?: string;
  error?: string;
}

function extractText(response: unknown): string {
  if (!response || typeof response !== 'object') return '';
  const obj = response as Record<string, unknown>;
  if (obj.parts && Array.isArray(obj.parts)) {
    return obj.parts
      .filter((p): p is { type: string; text?: string } =>
        typeof p === 'object' && p !== null && (p as Record<string, unknown>).type === 'text'
      )
      .map((p) => p.text ?? '')
      .join('\n');
  }
  if (typeof obj.text === 'string') return obj.text;
  return '';
}

async function createChildSession(
  client: MinimalClient,
  params: DelegateParams,
): Promise<string> {
  const createResp = await client.session.create({
    body: {
      parentID: params.sessionID,
      title: `AGNES: ${params.agent} — ${params.description}`,
    },
    query: { directory: params.directory },
  });

  if (createResp.error) {
    throw new Error(`Failed to create child session: ${JSON.stringify(createResp.error)}`);
  }

  return createResp.data.id;
}

export async function delegateBlocking(
  client: MinimalClient,
  params: DelegateParams,
): Promise<string> {
  let childId: string;
  try {
    childId = await createChildSession(client, params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `ERROR: failed to create child session — ${msg}`;
  }

  const promptResp = await client.session.prompt({
    path: { id: childId },
    body: {
      agent: params.agent,
      parts: [{ type: 'text', text: params.prompt }],
    },
    query: { directory: params.directory },
  });

  if (promptResp.error) {
    return `ERROR: delegation failed — ${JSON.stringify(promptResp.error)}`;
  }

  return extractText(promptResp.data);
}

export async function delegateAsync(
  client: MinimalClient,
  params: DelegateParams,
): Promise<string> {
  let childId: string;
  try {
    childId = await createChildSession(client, params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `ERROR: failed to create child session — ${msg}`;
  }

  const resp = await client.session.promptAsync({
    path: { id: childId },
    body: {
      agent: params.agent,
      parts: [{ type: 'text', text: params.prompt }],
    },
    query: { directory: params.directory },
  });

  if (resp.error) {
    return `ERROR: async delegation failed — ${JSON.stringify(resp.error)}`;
  }

  return childId;
}

export async function getSubagentResult(
  client: MinimalClient,
  sessionID: string,
  directory: string,
): Promise<SubagentResult> {
  try {
    const sessionResp = await client.session.get({
      path: { id: sessionID },
      query: { directory },
    });

    if (sessionResp.error) {
      if (sessionResp.error.status === 404) {
        return { status: 'not_found', error: `Session ${sessionID} not found` };
      }
      return { status: 'error', error: JSON.stringify(sessionResp.error) };
    }

    const messagesResp = await client.session.messages({
      path: { id: sessionID },
      query: { directory, limit: 5 },
    });

    if (messagesResp.error) {
      return { status: 'error', error: JSON.stringify(messagesResp.error) };
    }

    const messages = messagesResp.data;
    if (!messages || messages.length === 0) {
      return { status: 'pending' };
    }

    const assistantMessages = messages.filter((m: { info?: { role?: string } }) => m.info?.role === 'assistant');
    if (assistantMessages.length === 0) {
      return { status: 'pending' };
    }

    const lastMsg = assistantMessages[assistantMessages.length - 1];
    const output = extractText(lastMsg);

    return { status: 'completed', output };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('getSubagentResult threw', err);
    return { status: 'error', error: msg };
  }
}

const taskRefs = new Map<string, { sessionID: string; directory: string; agent: string; description: string }>();

export function recordTaskRef(
  taskRef: string,
  info: { sessionID: string; directory: string; agent: string; description: string },
): void {
  taskRefs.set(taskRef, info);
}

export function lookupTaskRef(taskRef: string):
  | { sessionID: string; directory: string; agent: string; description: string }
  | undefined {
  return taskRefs.get(taskRef);
}

export function clearTaskRefs(): void {
  taskRefs.clear();
}
