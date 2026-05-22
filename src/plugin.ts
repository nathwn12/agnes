import type { Plugin } from '@opencode-ai/plugin';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBootstrapContent } from './bootstrap.js';
import {
  findProjectRoot,
  readPlanIndex,
  updatePlanStatus,
  extractPromiseTag,
  freshStruggleMetrics,
  updateStruggleMetrics,
  extractErrorsFromOutput,
} from './state.js';
import type { StruggleMetrics } from './state.js';
import { getPlanGate, buildExecutionContext } from './runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillsDir = path.resolve(__dirname, '../skills');

type PluginConfig = {
  skills?: { paths?: string[] };
  [key: string]: unknown;
};

interface PartLike {
  type: string;
  text?: string;
  [key: string]: unknown;
}

interface SessionState {
  attempts: number;
  struggle: StruggleMetrics;
  lastPromiseTag: string | null;
}

const sessionState = new Map<string, SessionState>();
const MAX_SESSION_ENTRIES = 200;

function pruneSessionState(): void {
  if (sessionState.size > MAX_SESSION_ENTRIES) {
    const entries = [...sessionState.entries()];
    const toDelete = entries.slice(0, entries.length - MAX_SESSION_ENTRIES);
    for (const [key] of toDelete) {
      sessionState.delete(key);
    }
  }
}

function persistExecutionToPlan(attempts: number, struggle: StruggleMetrics): void {
  try {
    const root = findProjectRoot();
    if (!root) return;
    const index = readPlanIndex(root);
    if (!index || !index.activePlanId) return;
    updatePlanStatus({
      id: index.activePlanId,
      status: 'in_progress',
      attempts,
      struggle,
      projectRoot: root,
    });
  } catch (err) {
    console.debug('agnes: plan persistence failed —', err);
  }
}

function getSessionOrInit(sessionId: string): SessionState {
  let s = sessionState.get(sessionId);
  if (!s) {
    s = { attempts: 0, struggle: freshStruggleMetrics(), lastPromiseTag: null };
    sessionState.set(sessionId, s);
  }
  return s;
}

function extractAssistantText(parts: PartLike[]): string {
  return parts
    .filter((p): p is PartLike & { type: 'text'; text: string } =>
      p.type === 'text' && typeof p.text === 'string'
    )
    .map((p) => p.text!)
    .join('\n');
}

export const AgnesPlugin: Plugin = async ({ client }) => {
  client.app.log({
    body: { service: 'agnes', level: 'info', message: 'AGNES plugin loaded successfully' },
  });

  return {
    config: async (config: PluginConfig) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(skillsDir)) {
        config.skills.paths.push(skillsDir);
      }
    },

    'experimental.chat.messages.transform': async (_input, output) => {
      const bootstrap = getBootstrapContent();
      if (!bootstrap || !output.messages?.length) return;

      // Scan conversation history for the latest assistant message
      // to track progress across turns
      const assistantMsgs = output.messages.filter(
        (m) => m.info?.role === 'assistant'
      );
      if (assistantMsgs.length > 0) {
        const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
        const assistantText = extractAssistantText(lastAssistant.parts);
        if (assistantText) {
          const promiseTag = extractPromiseTag(assistantText);

          // Use a composite session ID from available metadata
          const sessionId = lastAssistant.info?.sessionID ?? 'global';
          const state = getSessionOrInit(sessionId);

          if (promiseTag) {
            state.lastPromiseTag = promiseTag;
            // Completion detected — reset attempt counter, prune old sessions
            state.attempts = 0;
            state.struggle = freshStruggleMetrics();
            pruneSessionState();
            persistExecutionToPlan(0, freshStruggleMetrics());
          } else {
            state.attempts++;
            const errors = extractErrorsFromOutput(assistantText);
            const lower = assistantText.toLowerCase();
            const hadProgress =
              lower.includes('```diff') ||
              lower.includes('file modified') ||
              lower.includes('created:') ||
              lower.includes('```') ||
              !(
                lower.includes('no progress') ||
                lower.includes("couldn't") ||
                lower.includes("can't") ||
                lower.includes('failed to') ||
                lower.includes('was unable') ||
                lower.includes('unable to') ||
                (lower.includes('error') && !lower.includes('not an error'))
              );
            state.struggle = updateStruggleMetrics(state.struggle, {
              hadProgress,
              durationMs: 0,
              errors,
              promiseTag: null,
            });
            persistExecutionToPlan(state.attempts, state.struggle);
          }
        }
      }

      const firstUser = output.messages.find((m) => m.info?.role === 'user');
      if (!firstUser || !firstUser.parts?.length) return;

      if (firstUser.parts.some((p) => p.type === 'text' && typeof p.text === 'string' && p.text.includes('EXTREMELY_IMPORTANT'))) return;

      let planGate = '';
      let execContext = '';

      try {
        const workspaceRoot = findProjectRoot();
        if (workspaceRoot) {
          planGate = getPlanGate(workspaceRoot) || '';

          const index = readPlanIndex(workspaceRoot);
          if (index && index.activePlanId) {
            const activeEntry = index.plans.find(p => p.id === index.activePlanId);
            if (activeEntry) {
              execContext = buildExecutionContext(activeEntry);
            }
          }
        }
      } catch (err) {
        console.debug('agnes: state read failed —', err);
      }

      let fullBootstrap = bootstrap + (planGate || '');
      if (execContext) {
        fullBootstrap += `\n\n## Execution Context\n${execContext}\n`;
      }

      const ref = firstUser.parts[0];
      firstUser.parts.unshift({
        id: randomUUID(),
        sessionID: ref.sessionID,
        messageID: ref.messageID,
        type: 'text',
        text: fullBootstrap,
      });
    },
  };
};
