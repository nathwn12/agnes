import type { Plugin } from '@opencode-ai/plugin';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBootstrapContent } from './bootstrap.js';
import {
  findProjectRoot,
  readPlanIndex,
  extractPromiseTag,
} from './state.js';
import { getPlanGate, buildExecutionContext, recordAttempt } from './runtime.js';

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

function extractAssistantText(parts: PartLike[]): string {
  return parts
    .filter((p): p is PartLike & { type: 'text'; text: string } =>
      p.type === 'text' && typeof p.text === 'string'
    )
    .map((p) => p.text)
    .join('\n');
}

export const AgnesPlugin: Plugin = async ({ client }) => {
  client.app.log({
    body: { service: 'agnes', level: 'info', message: 'AGNES plugin loaded successfully' },
  });

  return {
    config: async (config: PluginConfig) => {
      const paths = config.skills?.paths ? [...config.skills.paths] : [];
      if (!paths.includes(skillsDir)) {
        paths.push(skillsDir);
      }
      config.skills = config.skills || {};
      config.skills.paths = paths;
    },

    'experimental.chat.messages.transform': async (_input, output) => {
      const bootstrap = getBootstrapContent();
      if (!bootstrap || !output.messages?.length) return;

      // Track completion via promise tags across conversation turns
      const assistantMsgs = output.messages.filter(
        (m) => m.info?.role === 'assistant'
      );
      if (assistantMsgs.length > 0) {
        const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
        const assistantText = extractAssistantText(lastAssistant.parts);
        if (assistantText) {
          const promiseTag = extractPromiseTag(assistantText);
          const sessionId = lastAssistant.info?.sessionID ?? 'global';
          recordAttempt(sessionId, promiseTag);
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
