import * as logger from '../logger.js';
import {
  hasReturnStack,
  peekReturnStack,
  shiftReturnStack,
  consumePendingPromptReturn,
  setPendingStackedResponse,
  setPendingPromptReturn,
  OPENCODE_GENERIC,
  getAllPendingPromptReturns,
} from './returns.js';
import {
  getAllPendingEvaluations,
  createEvaluationPrompt,
  createYieldPrompt,
} from './loop.js';

const SUMMARY_LEAK_PATTERNS = [
  'Summary of Task Tool Output',
  'My task was to summarize',
  'The tool executed your command',
  'The command was executed successfully',
  'To complete your request',
];

function isSummaryLeak(msg: any): boolean {
  const parts = msg.parts || [];
  return parts.some((p: any) => {
    if (p.type !== 'step-start') return false;
    if (typeof p.text !== 'string') return false;
    return SUMMARY_LEAK_PATTERNS.some(pattern => p.text.includes(pattern));
  });
}

function replaceAndClear(
  part: any,
  msgIndex: number,
  newText: string,
  outputMessages: any[],
): void {
  part.text = newText;
  delete part.synthetic;

  // Remove stale assistant response that followed
  const nextIndex = msgIndex + 1;
  if (nextIndex < outputMessages.length) {
    const nextMsg = outputMessages[nextIndex];
    const role = nextMsg.info?.role ?? nextMsg.role;
    if (role === 'assistant') {
      outputMessages.splice(nextIndex, 1);
    }
  }
}

export async function chatMessagesTransform(_input: any, output: any): Promise<void> {
  try {
    if (!output.messages?.length) return;

    // === 1. Filter summary leak messages ===
    const filtered: any[] = [];
    for (const msg of output.messages) {
      const role = msg.info?.role ?? msg.role;
      if (role === 'assistant' && isSummaryLeak(msg)) continue;
      filtered.push(msg);
    }

    if (filtered.length !== output.messages.length) {
      output.messages.length = 0;
      output.messages.push(...filtered);
    }

    // === 2. Find the last OPENCODE_GENERIC message ===
    let lastGenericPart: any = null;
    let lastGenericMsg: any = null;
    let lastGenericIndex = -1;

    for (let i = 0; i < output.messages.length; i++) {
      const msg = output.messages[i];
      for (const part of msg.parts || []) {
        if (part.type === 'text' && part.text === OPENCODE_GENERIC) {
          lastGenericPart = part;
          lastGenericMsg = msg;
          lastGenericIndex = i;
        }
      }
    }

    // === 3. If no generic part, check for pending prompt returns (inline subtask path) ===
    if (!lastGenericPart) {
      const sessionIDs = [...new Set(
        output.messages.map((m: any) => m.info?.sessionID).filter(Boolean),
      )];

      for (const sid of sessionIDs) {
        const pendingPrompt = consumePendingPromptReturn(sid as string);
        if (pendingPrompt) {
          const existingUser = output.messages.find(
            (m: any) => (m.info?.role ?? m.role) === 'user',
          );
          if (existingUser) {
            const newMsg = JSON.parse(JSON.stringify(existingUser));
            newMsg.parts = [{ type: 'text', text: pendingPrompt }];
            if (newMsg.id) delete newMsg.id;
            if (newMsg.info?.id) delete newMsg.info.id;
            if (newMsg.info?.createdAt) delete newMsg.info.createdAt;
            output.messages.push(newMsg);
          } else {
            output.messages.push({
              info: { role: 'user' },
              parts: [{ type: 'text', text: pendingPrompt }],
            });
          }
          return;
        }
      }
      return;
    }

    // === 4. Check for pending prompt return (deferred by session.idle) ===
    const subtaskSessionID = lastGenericMsg?.info?.sessionID;
    const parentSessionID = subtaskSessionID;

    if (parentSessionID) {
      const pendingPrompt = consumePendingPromptReturn(parentSessionID);
      if (pendingPrompt) {
        replaceAndClear(lastGenericPart, lastGenericIndex, pendingPrompt, output.messages);
        setPendingStackedResponse(parentSessionID);
        return;
      }
    }

    // === 5. Check for loop evaluation ===
    for (const [_sid, loopState] of getAllPendingEvaluations()) {
      if (loopState.config.until) {
        const evalPrompt = createEvaluationPrompt(
          loopState.config.until,
          loopState.iteration,
          loopState.config.max,
        );
        lastGenericPart.text = evalPrompt;
      } else {
        const yieldPrompt = createYieldPrompt(
          loopState.iteration,
          loopState.config.max,
        );
        lastGenericPart.text = yieldPrompt;
      }
      // Don't delete evaluation — session.idle will parse the LLM response
      return;
    }

    // === 6. Check for pending returns from returnState ===
    const allPendingReturns = [...getAllPendingPromptReturns()];
    for (const [sessionID, returnPrompt] of allPendingReturns) {
      consumePendingPromptReturn(sessionID);
      if (returnPrompt.startsWith('/')) {
        // Command return: remove the generic message, session.idle will fire command
        if (lastGenericIndex >= 0) {
          output.messages.splice(lastGenericIndex, 1);
        }
        // session.idle will execute the command
        return;
      }
      // Prompt return: replace generic text
      replaceAndClear(lastGenericPart, lastGenericIndex, returnPrompt, output.messages);
      setPendingStackedResponse(sessionID);
      return;
    }

    // === 7. Check remaining return chain items ===
    if (parentSessionID) {
      const remaining = [...getAllPendingPromptReturns()];
      if (remaining.length > 0) return;
    }

    // === 8. Check stacked returns ===
    if (parentSessionID && hasReturnStack(parentSessionID)) {
      const nextReturn = peekReturnStack(parentSessionID)?.[0];
      if (nextReturn) {
        if (nextReturn.startsWith('/')) {
          // Remove message, let session.idle handle command
          if (lastGenericIndex >= 0) {
            output.messages.splice(lastGenericIndex, 1);
          }
          const returnPrompt = shiftReturnStack(parentSessionID);
          if (returnPrompt) {
            // Re-queue for session.idle to execute
          setPendingPromptReturn(parentSessionID, returnPrompt);
          }
          return;
        }
        const returnPrompt = shiftReturnStack(parentSessionID);
        if (returnPrompt) {
          replaceAndClear(lastGenericPart, lastGenericIndex, returnPrompt, output.messages);
          setPendingStackedResponse(parentSessionID);
        }
        return;
      }
    }

    // Nothing to do — leave generic message as is
  } catch (err) {
    logger.warn('message-transform exception', err);
  }
}
