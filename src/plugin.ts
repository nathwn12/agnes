import type { Plugin } from '@opencode-ai/plugin';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBootstrapContent } from './bootstrap.js';
import {
  findProjectRoot,
  readPlanIndex,
} from './state.js';
import { getPlanGate, buildExecutionContext } from './runtime.js';
import { serializeAgnesMessage } from './protocol.js';

import { detectShell } from './shell.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillsDir = path.resolve(__dirname, '../skills');

export const AgnesPlugin: Plugin = async () => {
  return {
    config: async (config: Record<string, unknown>) => {
      detectShell();
      const configObj = config as { skills?: { paths?: string[] } };
      const paths = configObj.skills?.paths ? [...configObj.skills.paths] : [];
      if (!paths.includes(skillsDir)) {
        paths.push(skillsDir);
      }
      configObj.skills = configObj.skills || {};
      configObj.skills.paths = paths;
    },

    'experimental.chat.messages.transform': async (_input, output) => {
      const bootstrap = getBootstrapContent();
      if (!bootstrap || !output.messages?.length) return;

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
      } catch {
        // non-fatal
      }

      let fullBootstrap = bootstrap + (planGate || '');

      if (execContext) {
        fullBootstrap += `\n\n## Execution Context\n${execContext}\n`;
      }

      fullBootstrap += `\n\n## Completion Protocol\nWhen all tasks are complete, place this HTML comment at the very end of your response (invisible to users, parsed by AGNES):\n<!-- ${serializeAgnesMessage({type:'completion',id:randomUUID(),timestamp:new Date().toISOString(),status:'DONE',summary:'all tasks completed successfully'})} -->\nFor partial results:\n<!-- ${serializeAgnesMessage({type:'result',taskId:'task-000',id:randomUUID(),timestamp:new Date().toISOString(),status:'DONE',content:'...',artifact:{}})} -->\n`;


      const { sessionID, messageID } = firstUser.parts[0];
      firstUser.parts.unshift({
        id: randomUUID(),
        sessionID,
        messageID,
        type: 'text',
        text: fullBootstrap,
      });
    },
  };
};
