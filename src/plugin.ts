import type { Plugin } from '@opencode-ai/plugin';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBootstrapContent } from './bootstrap.js';
import { findProjectRoot, buildPlanSummary } from './state.js';
import { getCurrentState, getPlanGateFromState } from './runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillsDir = path.resolve(__dirname, '../skills');

type PluginConfig = {
  skills?: { paths?: string[] };
  [key: string]: unknown;
};

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

      const firstUser = output.messages.find((m) => m.info?.role === 'user');
      if (!firstUser || !firstUser.parts?.length) return;

      if (firstUser.parts.some((p) => p.type === 'text' && typeof p.text === 'string' && p.text.includes('EXTREMELY_IMPORTANT'))) return;

      let planSummary = '';
      let planGate = '';
      try {
        const workspaceRoot = findProjectRoot();
        if (workspaceRoot) {
          planSummary = buildPlanSummary(workspaceRoot);
          const state = getCurrentState(workspaceRoot);
          if (state) planGate = getPlanGateFromState(state) || '';
        }
      } catch (err) {
        console.debug('agnes: state read failed —', err);
      }
      const fullBootstrap = bootstrap + (planSummary ? '\n\n' + planSummary : '') + (planGate || '');

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
