import { randomUUID } from 'node:crypto';
import * as logger from '../logger.js';
import { trackTask, updateTask, getTask, storeNamedResult, cleanupStaleTasks, validateSessionHasOutput, trackGroup, markGroupTaskCompleted, getGroupPendingCount } from './session.js';
import type { DelegateTask, DelegateInput, AgentDef } from './types.js';
import { AGENTS, TOOL_NAMES, DELEGATION_LIMITS, TERMINAL_AGENTS } from './types.js';

const POLL_INTERVAL_MS = 500;
const SYNC_TIMEOUT_MS = 120_000;
const MAX_POLL_COUNT = SYNC_TIMEOUT_MS / POLL_INTERVAL_MS;
const STABLE_POLLS_REQUIRED = 3;

interface SessionClient {
  create: (opts: { body: { parentID: string; title: string }; query: { directory: string } }) => Promise<{ data?: { id: string }; error?: string }>;
  promptAsync: (opts: { path: { id: string }; body: { agent?: string; tools?: Record<string, boolean>; parts: { type: string; text: string }[]; noReply?: boolean } }) => Promise<{ data?: unknown; error?: string }>;
  status: () => Promise<{ data?: Record<string, { type: string }> }>;
  messages: (opts: { path: { id: string }; query?: { limit?: number } }) => Promise<{ data?: unknown[] }>;
  delete: (opts: { path: { id: string } }) => Promise<{ data?: unknown; error?: string }>;
}

export class DelegationManager {
  private _session: SessionClient | null = null;
  private clientRef: NonNullable<unknown>;
  private directory: string = '';

  constructor(client: unknown) {
    this.clientRef = client as NonNullable<unknown>;
    if (client && typeof client === 'object') {
      const maybeSession = (client as Record<string, unknown>).session;
      if (maybeSession && typeof maybeSession === 'object') {
        this._session = maybeSession as SessionClient;
      }
    }
  }

  setDirectory(dir: string): void {
    this.directory = dir;
  }

  private get session(): SessionClient {
    if (!this._session) {
      const maybeSession = (this.clientRef as Record<string, unknown>).session;
      if (maybeSession && typeof maybeSession === 'object') {
        this._session = maybeSession as SessionClient;
      } else {
        throw new Error('DelegationManager: client.session not available');
      }
    }
    return this._session;
  }

  async launch(
    input: DelegateInput,
    parentSessionID: string,
    directory: string,
    channel?: { storeResult?: boolean; resultName?: string },
  ): Promise<DelegateTask> {
    cleanupStaleTasks();

    const agentDef: AgentDef | undefined = AGENTS[input.agent];
    if (!agentDef) {
      return this.makeErrorTask(input.agent, input.description, parentSessionID, `Unknown agent: ${input.agent}. Available: ${Object.keys(AGENTS).join(', ')}`);
    }

    const currentDepth = input.depth ?? 0;

    if (currentDepth >= DELEGATION_LIMITS.MAX_DEPTH) {
      return this.makeErrorTask(input.agent, input.description, parentSessionID,
        `Delegation blocked: maximum depth (${DELEGATION_LIMITS.MAX_DEPTH}) reached. Cannot delegate deeper to prevent infinite recursion. Complete the task directly or report back.`);
    }

    if (currentDepth >= DELEGATION_LIMITS.TERMINAL_DEPTH && TERMINAL_AGENTS.has(input.agent)) {
      return this.makeErrorTask(input.agent, input.description, parentSessionID,
        `Delegation blocked: ${input.agent} is a terminal agent (depth ${currentDepth} >= ${DELEGATION_LIMITS.TERMINAL_DEPTH}). Terminal agents cannot spawn sub-agents. Complete the task directly.`);
    }

    if (input.mode === 'background') {
      return this.launchBackground(input, parentSessionID, directory, channel);
    }
    return this.launchSync(input, parentSessionID, directory, channel);
  }

  private async launchBackground(
    input: DelegateInput,
    parentSessionID: string,
    directory: string,
    channel?: { storeResult?: boolean; resultName?: string },
  ): Promise<DelegateTask> {
    const description = `delegate: ${input.description}`;

    try {
      const createResult = await this.session.create({
        body: { parentID: parentSessionID, title: description },
        query: { directory },
      });

      if (createResult.error || !createResult.data?.id) {
        throw new Error(createResult.error ?? 'No session ID');
      }

      const sessionID = createResult.data.id;
      const nextDepth = (input.depth ?? 0) + 1;
      const taskID = randomUUID();

      const task: DelegateTask = {
        id: taskID,
        agent: input.agent,
        description: input.description,
        prompt: input.prompt,
        parentSessionID,
        sessionID,
        status: 'running',
        result: null,
        error: null,
        createdAt: Date.now(),
        completedAt: null,
        depth: nextDepth,
        groupID: input.groupID,
        noReply: input.noReply,
      };
      trackTask(task);

      if (input.groupID) {
        trackGroup(input.groupID, taskID);
      }

      await this.session.promptAsync({
        path: { id: sessionID },
        body: {
          agent: input.agent,
          tools: {
            [TOOL_NAMES.DELEGATE_TASK]: false,
            [TOOL_NAMES.GET_TASK_RESULT]: false,
            [TOOL_NAMES.LIST_TASKS]: false,
            [TOOL_NAMES.LIST_AGENTS]: false,
            [TOOL_NAMES.CANCEL_TASK]: false,
          },
          parts: [{ type: 'text', text: input.prompt }],
        },
      });

      this.pollForResult(sessionID, task.id, channel).catch((err) => {
        logger.warn('Background poll failed', err);
      });

      return task;
    } catch (err) {
      return this.makeErrorTask(input.agent, input.description, parentSessionID, err);
    }
  }

  private async launchSync(
    input: DelegateInput,
    parentSessionID: string,
    directory: string,
    channel?: { storeResult?: boolean; resultName?: string },
  ): Promise<DelegateTask> {
    const description = `delegate: ${input.description}`;

    try {
      const createResult = await this.session.create({
        body: { parentID: parentSessionID, title: description },
        query: { directory },
      });

      if (createResult.error || !createResult.data?.id) {
        throw new Error(createResult.error ?? 'No session ID');
      }

      const sessionID = createResult.data.id;
      const nextDepth = (input.depth ?? 0) + 1;
      const taskID = randomUUID();

      const task: DelegateTask = {
        id: taskID,
        agent: input.agent,
        description: input.description,
        prompt: input.prompt,
        parentSessionID,
        sessionID,
        status: 'running',
        result: null,
        error: null,
        createdAt: Date.now(),
        completedAt: null,
        depth: nextDepth,
        groupID: input.groupID,
        noReply: input.noReply,
      };
      trackTask(task);

      if (input.groupID) {
        trackGroup(input.groupID, taskID);
      }

      await this.session.promptAsync({
        path: { id: sessionID },
        body: {
          agent: input.agent,
          tools: {
            [TOOL_NAMES.DELEGATE_TASK]: false,
            [TOOL_NAMES.GET_TASK_RESULT]: false,
            [TOOL_NAMES.LIST_TASKS]: false,
            [TOOL_NAMES.LIST_AGENTS]: false,
            [TOOL_NAMES.CANCEL_TASK]: false,
          },
          parts: [{ type: 'text', text: input.prompt }],
        },
      });

      const pollResult = await this.pollWithSafety(sessionID, Date.now());
      const resultText = pollResult.text;

      if (channel?.storeResult && channel.resultName) {
        storeNamedResult(parentSessionID, channel.resultName, resultText);
      }

      const finalStatus = pollResult.timedOut ? 'timeout' : 'completed';
      updateTask(task.id, {
        status: finalStatus,
        result: resultText,
        completedAt: Date.now(),
      });

      if (task.groupID) {
        this.handleGroupCompletion(task, finalStatus);
      }

      if (input.agent === 'build' && finalStatus === 'completed') {
        this.triggerAutoVerify(input, parentSessionID, directory, resultText).catch((err) => {
          logger.warn('Auto-verify failed', err);
        });
      }

      return getTask(task.id)!;
    } catch (err) {
      return this.makeErrorTask(input.agent, input.description, parentSessionID, err);
    }
  }

  private async handleGroupCompletion(task: DelegateTask, finalStatus: string): Promise<void> {
    if (!task.groupID) return;
    const remaining = markGroupTaskCompleted(task.groupID);

    if (remaining > 0 && finalStatus !== 'error' && task.noReply !== false) {
      try {
        await this.session.promptAsync({
          path: { id: task.parentSessionID },
          body: {
            noReply: true,
            parts: [{ type: 'text', text: `[${task.agent}] Subtask completed: ${task.description}` }],
          },
        });
      } catch {
      }
    }
  }

  private async triggerAutoVerify(
    _input: DelegateInput,
    parentSessionID: string,
    directory: string,
    resultText: string,
  ): Promise<void> {
    try {
      const createResult = await this.session.create({
        body: { parentID: parentSessionID, title: `auto-verify: ${_input.description}` },
        query: { directory },
      });

      if (createResult.error || !createResult.data?.id) return;

      const sessionID = createResult.data.id;
      const verifyTask: DelegateTask = {
        id: randomUUID(),
        agent: 'general',
        description: `Auto-verify: ${_input.description}`,
        prompt: `Review the following completed work for correctness, edge cases, and spec compliance:\n\n${resultText}\n\nReport any issues found. If clean, respond with "VERIFICATION PASSED".`,
        parentSessionID,
        sessionID,
        status: 'running',
        result: null,
        error: null,
        createdAt: Date.now(),
        completedAt: null,
        depth: (_input.depth ?? 0) + 2,
      };
      trackTask(verifyTask);

      await this.session.promptAsync({
        path: { id: sessionID },
        body: {
          agent: 'general',
          tools: {
            [TOOL_NAMES.DELEGATE_TASK]: false,
            [TOOL_NAMES.GET_TASK_RESULT]: false,
            [TOOL_NAMES.LIST_TASKS]: false,
            [TOOL_NAMES.LIST_AGENTS]: false,
            [TOOL_NAMES.CANCEL_TASK]: false,
          },
          parts: [{ type: 'text', text: verifyTask.prompt }],
        },
      });

      this.pollForResult(sessionID, verifyTask.id).catch((err) => {
        logger.warn('Auto-verify poll failed', err);
      });
    } catch (err) {
      logger.warn('Failed to trigger auto-verify', err);
    }
  }

  private async pollWithSafety(
    sessionID: string,
    startTime: number,
  ): Promise<{ text: string; timedOut: boolean }> {
    let pollCount = 0;
    let stablePolls = 0;
    let lastMsgCount = 0;
    let hasStartedOutputting = false;

    while (pollCount < MAX_POLL_COUNT) {
      pollCount++;
      const elapsed = Date.now() - startTime;

      if (elapsed >= SYNC_TIMEOUT_MS) {
        logger.warn(`Poll timeout for session ${sessionID} after ${elapsed}ms`);
        return { text: '(timeout)', timedOut: true };
      }

      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

      try {
        const statusResult = await this.session.status();
        const sessionStatus = statusResult.data?.[sessionID];
        if (!sessionStatus || sessionStatus.type !== 'idle') {
          stablePolls = 0;
          continue;
        }

        if (elapsed < 2_000) continue;

        const msgs = await this.session.messages({ path: { id: sessionID } });
        const messages = (msgs.data ?? []) as Array<{ info?: { role?: string }; parts?: { type?: string; text?: string }[] }>;
        const hasAssistant = messages.some(m => m.info?.role === 'assistant');

        if (!hasAssistant) continue;

        const hasOutput = validateSessionHasOutput(messages);
        if (hasOutput) {
          hasStartedOutputting = true;
        }

        if (messages.length === lastMsgCount) {
          stablePolls++;
          if (stablePolls >= STABLE_POLLS_REQUIRED) {
            if (!hasStartedOutputting) {
              stablePolls = 0;
              continue;
            }
            const text = extractLastAssistantText(messages);
            return { text, timedOut: false };
          }
        } else {
          stablePolls = 0;
          lastMsgCount = messages.length;
        }
      } catch (err) {
        logger.warn(`Poll error for session ${sessionID}`, err);
        continue;
      }
    }

    logger.warn(`Max polls reached for session ${sessionID}`);
    return { text: '(max polls reached)', timedOut: true };
  }

  private async pollForResult(
    sessionID: string,
    taskID: string,
    channel?: { storeResult?: boolean; resultName?: string },
  ): Promise<void> {
    const startTime = Date.now();
    const pollResult = await this.pollWithSafety(sessionID, startTime);
    const task = getTask(taskID);
    if (!task) return;

    const finalStatus = pollResult.timedOut ? 'timeout' : 'completed';
    updateTask(taskID, {
      status: finalStatus,
      result: pollResult.text,
      completedAt: Date.now(),
    });

    if (channel?.storeResult && channel.resultName) {
      storeNamedResult(task.parentSessionID, channel.resultName, pollResult.text);
    }

    if (task.groupID) {
      await this.handleGroupCompletion(task, finalStatus).catch(() => {});
    }
  }

  private makeErrorTask(agent: string, description: string, parentSessionID: string, err: unknown): DelegateTask {
    const task: DelegateTask = {
      id: randomUUID(),
      agent,
      description,
      prompt: '',
      parentSessionID,
      sessionID: '',
      status: 'error',
      result: null,
      error: err instanceof Error ? err.message : String(err),
      createdAt: Date.now(),
      completedAt: Date.now(),
      depth: 0,
    };
    trackTask(task);
    return task;
  }
}

function extractLastAssistantText(
  messages: { info?: { role?: string }; parts?: { type?: string; text?: string }[] }[],
): string {
  const assistantMessages = messages.filter(m => m.info?.role === 'assistant');
  const last = assistantMessages[assistantMessages.length - 1];
  if (!last?.parts) return '(no output)';
  return last.parts
    .filter(p => p.type === 'text' || p.type === 'reasoning')
    .map(p => p.text ?? '')
    .filter(Boolean)
    .join('\n');
}
