import { randomUUID } from 'node:crypto';
import * as logger from '../logger.js';
import { SessionStore, getGlobalSessionStore } from './session.js';
import type { DelegateTask, DelegateInput } from './types.js';
import { AGENTS, TOOL_NAMES, DELEGATION_LIMITS, TERMINAL_AGENTS } from './types.js';
import { tryAcquire, release as releaseSlot, getConcurrencyStats } from './concurrency.js';

const MIN_POLL_INTERVAL = 500;
const MAX_POLL_INTERVAL = 5_000;
const SYNC_TIMEOUT_MS = 120_000;
const STABLE_POLLS_REQUIRED = 3;
const FINAL_VERIFY_DELAY_MS = 200;

interface SessionClient {
  promptAsync: (opts: { path: { id: string }; body: { agent?: string; tools?: Record<string, boolean>; parts: { type: string; text: string }[]; noReply?: boolean } }) => Promise<{ data?: unknown; error?: string }>;
  status: () => Promise<{ data?: Record<string, { type: string }> }>;
  messages: (opts: { path: { id: string }; query?: { limit?: number } }) => Promise<{ data?: unknown[] }>;
  delete: (opts: { path: { id: string } }) => Promise<{ data?: unknown; error?: string }>;
}

export class OrchestratorManager {
  private sessionClient: SessionClient | null = null;
  private store: SessionStore;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private currentPollInterval = MIN_POLL_INTERVAL;

  constructor(client: unknown) {
    this.store = getGlobalSessionStore();
    if (client && typeof client === 'object') {
      const maybe = (client as Record<string, unknown>).session;
      if (maybe && typeof maybe === 'object') {
        this.sessionClient = maybe as SessionClient;
      }
    }
  }

  private get session(): SessionClient {
    if (!this.sessionClient) throw new Error('OrchestratorManager: client.session not available');
    return this.sessionClient;
  }

  // ========================================================================
  // Public API
  // ========================================================================

  async launch(
    input: DelegateInput,
    parentSessionID: string,
    _directory: string,
    channel?: { storeResult?: boolean; resultName?: string },
  ): Promise<DelegateTask> {
    this.store.cleanupStaleTasks();

    const agentDef = AGENTS[input.agent];
    if (!agentDef) {
      return this.makeErrorTask(input.agent, input.description, parentSessionID, `Unknown agent: ${input.agent}. Available: ${Object.keys(AGENTS).join(', ')}`);
    }

    const currentDepth = input.depth ?? 0;

    if (currentDepth >= DELEGATION_LIMITS.MAX_DEPTH) {
      return this.makeErrorTask(input.agent, input.description, parentSessionID,
        `Delegation blocked: maximum depth (${DELEGATION_LIMITS.MAX_DEPTH}) reached.`);
    }

    if (currentDepth >= DELEGATION_LIMITS.TERMINAL_DEPTH && TERMINAL_AGENTS.has(input.agent)) {
      return this.makeErrorTask(input.agent, input.description, parentSessionID,
        `Delegation blocked: ${input.agent} is a terminal agent at depth ${currentDepth}.`);
    }

    // Concurrency check
    if (!tryAcquire(input.agent)) {
      return this.makeErrorTask(input.agent, input.description, parentSessionID,
        `Concurrency limit reached for ${input.agent}. Active: ${getConcurrencyStats()[input.agent]?.active ?? 0}, Limit: ${getConcurrencyStats()[input.agent]?.limit ?? 3}. Wait for tasks to complete.`);
    }

    try {
      if (input.mode === 'background') {
        return this.launchBackground(input, parentSessionID, channel);
      }
      return await this.launchSync(input, parentSessionID, channel);
    } finally {
      releaseSlot(input.agent);
    }
  }

  getTask(id: string): DelegateTask | undefined {
    return this.store.getTask(id);
  }

  getAllTasks(): DelegateTask[] {
    return this.store.getAllTasks();
  }

  getRunningTasks(): DelegateTask[] {
    return this.store.getRunningTasks();
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.store.getTask(taskId);
    if (!task || (task.status !== 'running' && task.status !== 'pending')) return false;
    this.store.updateTask(taskId, { status: 'error' as const, error: 'Cancelled by user', completedAt: Date.now() });
    return true;
  }

  async getResult(taskId: string): Promise<string | null> {
    const task = this.store.getTask(taskId);
    if (!task) return null;
    if (task.result) return task.result;
    if (task.status === 'error' || task.status === 'timeout') return task.error ?? '(error)';
    if (task.status === 'running') return null;

    // Fetch from session
    try {
      const msgs = await this.session.messages({ path: { id: task.sessionID } });
      const messages = (msgs.data ?? []) as Array<{ info?: { role?: string }; parts?: { type?: string; text?: string }[] }>;
      const lastText = extractLastAssistantText(messages);
      task.result = lastText;
      return lastText;
    } catch {
      return null;
    }
  }

  startPolling(): void {
    if (this.pollTimer) return;
    this.scheduleNextPoll();
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ========================================================================
  // Background Mode
  // ========================================================================

  private async launchBackground(
    input: DelegateInput,
    parentSessionID: string,
    channel?: { storeResult?: boolean; resultName?: string },
  ): Promise<DelegateTask> {
    const taskID = randomUUID();
    const nextDepth = (input.depth ?? 0) + 1;

    const task: DelegateTask = {
      id: taskID,
      agent: input.agent,
      description: input.description,
      prompt: input.prompt,
      parentSessionID,
      sessionID: '',
      status: 'running',
      result: null,
      error: null,
      createdAt: Date.now(),
      completedAt: null,
      depth: nextDepth,
      groupID: input.groupID,
      noReply: input.noReply,
    };

    this.store.trackTask(task);

    try {
      await this.session.promptAsync({
        path: { id: parentSessionID },
        body: {
          agent: input.agent,
          tools: {
            [TOOL_NAMES.DELEGATE_TASK]: false,
            [TOOL_NAMES.GET_TASK_RESULT]: false,
            [TOOL_NAMES.CANCEL_TASK]: false,
          },
          parts: [{ type: 'text', text: input.prompt }],
          noReply: input.noReply ?? true,
        },
      });

      // Store the task for polling
      this.store.updateTask(taskID, { sessionID: parentSessionID });

      // Async poll in background
      this.pollForResult(parentSessionID, taskID, channel).catch(err => {
        logger.warn('Background poll failed', err);
      });

      return task;
    } catch (err) {
      this.store.updateTask(taskID, { status: 'error' as const, error: err instanceof Error ? err.message : String(err), completedAt: Date.now() });
      return task;
    }
  }

  // ========================================================================
  // Sync Mode
  // ========================================================================

  private async launchSync(
    input: DelegateInput,
    parentSessionID: string,
    channel?: { storeResult?: boolean; resultName?: string },
  ): Promise<DelegateTask> {
    const taskID = randomUUID();
    const nextDepth = (input.depth ?? 0) + 1;

    const task: DelegateTask = {
      id: taskID,
      agent: input.agent,
      description: input.description,
      prompt: input.prompt,
      parentSessionID,
      sessionID: parentSessionID,
      status: 'running',
      result: null,
      error: null,
      createdAt: Date.now(),
      completedAt: null,
      depth: nextDepth,
      groupID: input.groupID,
      noReply: input.noReply,
    };

    this.store.trackTask(task);

    try {
      await this.session.promptAsync({
        path: { id: parentSessionID },
        body: {
          agent: input.agent,
          tools: {
            [TOOL_NAMES.DELEGATE_TASK]: false,
            [TOOL_NAMES.GET_TASK_RESULT]: false,
            [TOOL_NAMES.CANCEL_TASK]: false,
          },
          parts: [{ type: 'text', text: input.prompt }],
        },
      });

      const pollResult = await this.pollWithSafety(parentSessionID, Date.now());
      const resultText = pollResult.text;
      const finalStatus = pollResult.timedOut ? 'timeout' : 'completed';

      if (channel?.storeResult && channel.resultName) {
        this.store.storeNamedResult(parentSessionID, channel.resultName, resultText);
      }

      this.store.updateTask(task.id, { status: finalStatus, result: resultText, completedAt: Date.now() });

      if (input.agent === 'build' && finalStatus === 'completed') {
        this.triggerAutoVerify(input, parentSessionID, resultText).catch(err => {
          logger.warn('Auto-verify failed', err);
        });
      }

      return this.store.getTask(task.id)!;
    } catch (err) {
      this.store.updateTask(task.id, { status: 'error' as const, error: err instanceof Error ? err.message : String(err), completedAt: Date.now() });
      return this.store.getTask(task.id)!;
    }
  }

  // ========================================================================
  // Auto-Verify Pipeline
  // ========================================================================

  private async triggerAutoVerify(_input: DelegateInput, parentSessionID: string, resultText: string): Promise<void> {
    try {
      await this.session.promptAsync({
        path: { id: parentSessionID },
        body: {
          agent: 'general',
          tools: {
            [TOOL_NAMES.DELEGATE_TASK]: false,
            [TOOL_NAMES.GET_TASK_RESULT]: false,
            [TOOL_NAMES.CANCEL_TASK]: false,
          },
          parts: [{ type: 'text', text: `Review the following completed work for correctness, edge cases, and spec compliance:\n\n${resultText}\n\nReport any issues found. If clean, respond with "VERIFICATION PASSED".` }],
          noReply: true,
        },
      });
    } catch (err) {
      logger.warn('Failed to trigger auto-verify', err);
    }
  }

  // ========================================================================
  // Polling
  // ========================================================================

  private async pollWithSafety(
    sessionID: string,
    startTime: number,
  ): Promise<{ text: string; timedOut: boolean }> {
    let pollCount = 0;
    let stablePolls = 0;
    let lastMsgText = '';
    let hasStartedOutputting = false;

    while (pollCount < SYNC_TIMEOUT_MS / MIN_POLL_INTERVAL) {
      pollCount++;
      const elapsed = Date.now() - startTime;

      if (elapsed >= SYNC_TIMEOUT_MS) {
        logger.warn(`Poll timeout for session ${sessionID} after ${elapsed}ms`);
        return { text: '(timeout)', timedOut: true };
      }

      await new Promise(r => setTimeout(r, MIN_POLL_INTERVAL));

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

        if (!messages.some(m => m.info?.role === 'assistant')) continue;

        const hasOutput = this.store.validateSessionHasOutput(messages);
        if (hasOutput) hasStartedOutputting = true;
        if (!hasStartedOutputting) continue;

        const currentText = extractLastAssistantText(messages);
        if (currentText === lastMsgText) {
          stablePolls++;
          if (stablePolls >= STABLE_POLLS_REQUIRED) {
            await new Promise(r => setTimeout(r, FINAL_VERIFY_DELAY_MS));
            const verifyMsgs = await this.session.messages({ path: { id: sessionID } });
            const verifyMessages = (verifyMsgs.data ?? []) as Array<{ info?: { role?: string }; parts?: { type?: string; text?: string }[] }>;
            const verifyText = extractLastAssistantText(verifyMessages);
            if (verifyText !== currentText) {
              stablePolls = 0;
              lastMsgText = verifyText;
              continue;
            }
            return { text: currentText, timedOut: false };
          }
        } else {
          stablePolls = 0;
          lastMsgText = currentText;
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
    const pollResult = await this.pollWithSafety(sessionID, Date.now());
    const task = this.store.getTask(taskID);
    if (!task) return;

    const finalStatus = pollResult.timedOut ? 'timeout' : 'completed';
    this.store.updateTask(taskID, {
      status: finalStatus,
      result: pollResult.text,
      completedAt: Date.now(),
    });

    if (channel?.storeResult && channel.resultName) {
      this.store.storeNamedResult(task.parentSessionID, channel.resultName, pollResult.text);
    }
  }

  // ========================================================================
  // Adaptive Polling (scheduled)
  // ========================================================================

  private scheduleNextPoll(): void {
    const running = this.store.getRunningTasks().length;
    this.adjustPollInterval(running);

    this.pollTimer = setTimeout(() => {
      this.pollRunning().then(() => {
        if (this.pollTimer) this.scheduleNextPoll();
      });
    }, this.currentPollInterval) as unknown as ReturnType<typeof setTimeout>;
  }

  private async pollRunning(): Promise<void> {
    const running = this.store.getRunningTasks();
    if (running.length === 0) { this.stopPolling(); return; }

    try {
      const statusResult = await this.session.status();
      const allStatuses = (statusResult.data ?? {}) as Record<string, { type: string }>;

      for (const task of running) {
        if (task.status !== 'running') continue;
        const status = allStatuses[task.sessionID];
        if (!status || status.type !== 'idle') continue;

        try {
          const msgs = await this.session.messages({ path: { id: task.sessionID } });
          const messages = (msgs.data ?? []) as Array<{ info?: { role?: string }; parts?: { type?: string; text?: string }[] }>;
          const hasOutput = this.store.validateSessionHasOutput(messages);
          if (!hasOutput) continue;

          const resultText = extractLastAssistantText(messages);
          this.store.updateTask(task.id, { status: 'completed' as const, result: resultText, completedAt: Date.now() });

          if (task.agent === 'build') {
            this.triggerAutoVerify(
              { agent: task.agent, description: task.description, prompt: task.prompt, mode: 'background', depth: task.depth },
              task.parentSessionID,
              resultText,
            ).catch(() => {});
          }
        } catch {
          // individual task poll error — continue
        }
      }
    } catch {
      // global poll error — continue
    }
  }

  private adjustPollInterval(runningCount: number): void {
    if (runningCount === 0) {
      this.currentPollInterval = Math.min(this.currentPollInterval * 1.5, MAX_POLL_INTERVAL);
    } else if (runningCount <= 3) {
      this.currentPollInterval = MIN_POLL_INTERVAL;
    } else {
      this.currentPollInterval = Math.max(MIN_POLL_INTERVAL, Math.round(MAX_POLL_INTERVAL - (runningCount / 10) * (MAX_POLL_INTERVAL - MIN_POLL_INTERVAL)));
    }
  }

  // ========================================================================
  // Helpers
  // ========================================================================

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
    this.store.trackTask(task);
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
