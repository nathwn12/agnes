import * as logger from '../logger.js';
import {
  consumeDeferredPromptReturn,
  hasReturnChain,
  shiftReturnChain,
  hasReturnStack,
  shiftReturnStack,
  consumePendingPromptReturn,
  setPendingPromptReturn,
  setLastReturnType,
  hasPendingStackedResponse,
  clearPendingStackedResponse,
  pushReturnStack,
} from './returns.js';
import {
  getPendingEvaluation,
  clearPendingEvaluation,
  parseLoopDecision,
  incrementLoopIteration,
  getLoopState,
  clearLoop,
} from './loop.js';
import { getPendingCapture, storeNamedResult } from './session.js';

interface SessionClient {
  promptAsync: (opts: { path: { id: string }; body: { parts: { type: string; text: string }[]; noReply?: boolean } }) => Promise<unknown>;
  command: (opts: { path: { id: string }; body: { command: string; arguments: string } }) => Promise<unknown>;
  messages: (opts: { path: { id: string } }) => Promise<{ data?: unknown[]; error?: string }>;
}

export async function handleSessionIdle(
  sessionID: string,
  client: SessionClient,
): Promise<void> {
  if (!client) return;
  logger.info(`session.idle: ${sessionID}`);

  // 0. Capture $RESULT[name] from completed subtask
  try {
    const msgs_result = await client.messages({ path: { id: sessionID } });
    const msgs_data = (msgs_result.data ?? []) as Array<{ info?: { role?: string }; parts?: { type?: string; text?: string }[] }>;
    const reversed = [...msgs_data].reverse();
    for (const msg of reversed) {
      const role = msg.info?.role ?? (msg as any).role;
      if (role !== 'assistant') continue;
      for (const part of (msg.parts ?? []).reverse()) {
        if ((part as any).ignored) continue;
        if (part.type === 'text' && part.text?.trim()) {
          // Check first user message for pending capture
          const firstUserMsg = msgs_data.find(
            (m: { info?: { role?: string } }) => m.info?.role === 'user'
          );
          if (firstUserMsg) {
            for (const firstPart of firstUserMsg.parts ?? []) {
              const promptContent = firstPart.type === 'subtask'
                ? (firstPart as any).prompt?.trim()
                : firstPart.type === 'text'
                  ? firstPart.text?.trim()
                  : null;
              if (promptContent) {
                const pendingCapture = getPendingCapture(promptContent);
                if (pendingCapture && pendingCapture.parentSessionID === sessionID) {
                  storeNamedResult(pendingCapture.parentSessionID, pendingCapture.name, part.text);
                  logger.info(`Captured $RESULT[${pendingCapture.name}] for ${sessionID}`);
                }
              }
            }
          }
          break;
        }
      }
      break;
    }
  } catch {
    // Best-effort capture
  }

  // 1. Check for pending loop evaluation
  const evalState = getPendingEvaluation(sessionID);
  if (evalState) {
    let decision: 'break' | 'continue' = 'continue';

    if (evalState.config.until) {
      try {
        const msgs = await client.messages({ path: { id: sessionID } });
        const messages = (msgs.data ?? []) as Array<{ parts?: { type?: string; text?: string }[] }>;
        const lastMsg = messages[messages.length - 1];
        const lastText = lastMsg?.parts?.find((p: any) => p.type === 'text')?.text ?? '';
        decision = parseLoopDecision(lastText);
      } catch {
        decision = 'break';
      }
    }

    clearPendingEvaluation(sessionID);

    if (decision === 'continue') {
      incrementLoopIteration(sessionID);
      const state = getLoopState(sessionID);
      if (state) {
        if (!(state.iteration >= state.config.max)) {
          await reExecuteLoop(state, client, sessionID);
          return;
        }
      }
    }

    if (evalState.deferredReturns?.length) {
      pushReturnStack(sessionID, [...evalState.deferredReturns]);
    }
    clearLoop(sessionID);
  }

  // 2. Check for pending stacked response flag (skip if still waiting)
  if (hasPendingStackedResponse(sessionID)) {
    clearPendingStackedResponse(sessionID);
    return;
  }

  // 3. Process deferred return prompt
  const deferredReturn = consumeDeferredPromptReturn(sessionID);
  if (deferredReturn) {
    await executeReturnItem(deferredReturn, sessionID, client);
    return;
  }

  // 4. Process pending prompt return
  const pendingReturn = consumePendingPromptReturn(sessionID);
  if (pendingReturn) {
    if (pendingReturn.startsWith('/')) {
      await executeReturnItem(pendingReturn, sessionID, client);
      return;
    }
    // Prompt return — will be handled by message-hooks next turn
    return;
  }

  // 5. Process stacked returns (from inline subtasks)
  if (hasReturnStack(sessionID)) {
    const next = shiftReturnStack(sessionID);
    if (next) {
      await executeReturnItem(next, sessionID, client);
      return;
    }
  }

  // 6. Process return chain
  if (hasReturnChain(sessionID)) {
    const next = shiftReturnChain(sessionID);
    if (next) {
      await executeReturnItem(next, sessionID, client);
      return;
    }
  }

  // Nothing left to do
  logger.info(`session.idle: ${sessionID} — no pending work`);
}

async function reExecuteLoop(
  state: { commandName: string; commandArgs: string },
  client: SessionClient,
  sessionID: string,
): Promise<void> {
  try {
    await client.promptAsync({
      path: { id: sessionID },
      body: {
        parts: [{ type: 'text', text: state.commandArgs || '' }],
      },
    });
  } catch (err) {
    logger.warn('Loop re-execution failed', err);
  }
}

async function executeReturnItem(
  item: string,
  sessionID: string,
  client: SessionClient,
): Promise<void> {
  if (item.startsWith('/')) {
    const cmd = item.slice(1).trim();
    const spaceIdx = cmd.indexOf(' ');
    const commandName = spaceIdx > 0 ? cmd.slice(0, spaceIdx) : cmd;
    const args = spaceIdx > 0 ? cmd.slice(spaceIdx + 1) : '';

    setLastReturnType(sessionID, 'command');
    try {
      await client.command({
        path: { id: sessionID },
        body: { command: commandName, arguments: args },
      });
    } catch (err) {
      logger.warn(`Return command failed: ${commandName}`, err);
    }
  } else {
    setLastReturnType(sessionID, 'prompt');
    setPendingPromptReturn(sessionID, item);
  }
}
