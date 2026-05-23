import type { Plugin } from '@opencode-ai/plugin';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getBootstrapContent,
  buildBootstrap,
  getBootstrapPackageInfo,
} from './bootstrap.js';
import type { OrchestratorRules } from './bootstrap.js';
import type { PlanIndex } from './state.js';
import {
  findProjectRoot,
  readPlanIndex,
} from './state.js';
import { getPlanGate, buildExecutionContext } from './runtime.js';
import { serializeAgnesMessage } from './protocol.js';

import { detectShell } from './shell.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillsDir = path.resolve(__dirname, '../skills');

let _modelName: string | undefined;

const DEEPSEEK_V4_PATTERNS = [
  /^deepseek\/deepseek-v4/i,
  /^deepseek-v4/i,
  /^ds4\//i,
  /deepseek.*v4/i,
];

export function isDeepSeekV4(modelName: string): boolean {
  return DEEPSEEK_V4_PATTERNS.some((p) => p.test(modelName));
}

function buildStructuredBootstrap(): string {
  const proseBootstrap = getBootstrapContent();
  if (!proseBootstrap) return '';

  const pkg = getBootstrapPackageInfo();
  const rules: OrchestratorRules = {
    delegate: true,
    parallelize: true,
    onePercent: true,
    verify: true,
    noSharedEdits: true,
    freshSubagents: true,
    scarcity: true,
  };

  let index: PlanIndex | null = null;
  try {
    const workspaceRoot = findProjectRoot();
    if (workspaceRoot) {
      index = readPlanIndex(workspaceRoot);
    }
  } catch {
    // non-fatal
  }

  const shell = detectShell();

  const structuredBlocks = buildBootstrap({
    pkg,
    rules,
    index,
    shell: {
      name: shell.shellType,
      version: shell.shellType,
      antiPatterns: shell.antiPatterns,
      preferredSyntax: shell.preferredSyntax,
    },
    exec: {
      attempt: 1,
      struggleDetected: false,
      lastPromiseTag: null,
    },
  });

  return proseBootstrap + '\n\n## Structured Protocol Blocks\n' + structuredBlocks + '\n';
}

export const AgnesPlugin: Plugin = async () => {
  return {
    config: async (config: Record<string, unknown>) => {
      detectShell();
      const configObj = config as Record<string, unknown>;
      _modelName = typeof configObj.model === 'string' ? configObj.model : undefined;

      if (_modelName && isDeepSeekV4(_modelName)) {
        configObj.provider = {
          ...(configObj.provider as Record<string, unknown> || {}),
          interleaved: { field: "reasoning_content" },
        } as Record<string, unknown>;
      }

      const skillsConfig = configObj.skills as { paths?: string[] } | undefined;
      const paths = skillsConfig?.paths ? [...skillsConfig.paths] : [];
      if (!paths.includes(skillsDir)) {
        paths.push(skillsDir);
      }
      configObj.skills = { ...(configObj.skills as Record<string, unknown> || {}), paths };
    },

    "chat.message": async (input) => {
      if (input.model?.modelID && typeof input.model.modelID === 'string') {
        _modelName = input.model.modelID;
      }
    },

    'experimental.chat.messages.transform': async (_input, output) => {
      const isDsV4 = _modelName ? isDeepSeekV4(_modelName) : false;
      const bootstrap = isDsV4 ? buildStructuredBootstrap() : getBootstrapContent();
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

      const modelLabel = _modelName ? `- Current model: \`${_modelName}\`` : '';

      let fullBootstrap = bootstrap + (planGate || '');

      if (modelLabel) {
        fullBootstrap += `\n\n## Active Model\n${modelLabel}\n`;
      }

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
