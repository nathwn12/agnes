import type { Plugin } from '@opencode-ai/plugin';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBootstrapContent } from './bootstrap.js';
import { getStateFileInjections } from './state.js';
import { getPlanGate } from './runtime.js';

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

    'experimental.chat.messages.transform': async (_input: {}, output: {
      messages: Array<{
        info: { role: string };
        parts: Array<{ type: string; text?: string }>;
      }>;
    }) => {
      const bootstrap = getBootstrapContent();
      if (!bootstrap || !output.messages?.length) return;

      const firstUser = output.messages.find((m) => m.info?.role === 'user');
      if (!firstUser || !firstUser.parts?.length) return;

      if (firstUser.parts.some((p) => p.type === 'text' && typeof p.text === 'string' && p.text.includes('EXTREMELY_IMPORTANT'))) return;

      const stateInjections = getStateFileInjections();
      const planGate = getPlanGate();
      const fullBootstrap = bootstrap + stateInjections + (planGate || '');

      const ref = firstUser.parts[0];
      firstUser.parts.unshift({
        ...ref,
        type: 'text',
        text: fullBootstrap,
      });
    },
  };
};
