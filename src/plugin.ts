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
import { getPlanGate, buildExecutionContext, classifyComplexity } from './runtime.js';
import { serializeAgnesMessage } from './protocol.js';

import { detectShell } from './shell.js';
import {
  collectMessageText,
  evaluateCompactionPolicy,
  rememberCompactionState,
} from './compaction.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillsDir = path.resolve(__dirname, '../skills');

let _modelName: string | undefined;

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
    answerDirectly: true,
    namedRoles: {
      executor: "Runs commands, tests, builds. Returns compact pass/fail + file refs. Never suggests fixes.",
      explorer: "Codebase research only. Glob → grep → selective read. Read-only. Never edits.",
      planner: "Creates/refreshes plan-NNN.yaml from task requirements using planner skill.",
      builder: "Implements one sub-task from plan. Delegates bash to executor and review to reviewer.",
      reviewer: "Reviews diff against sub-task scope using reviewer skill. Writes findings.",
    },
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

      configObj.provider = {
        ...(configObj.provider as Record<string, unknown> || {}),
        interleaved: { field: "reasoning_content" },
      } as Record<string, unknown>;

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
      const bootstrap = buildStructuredBootstrap();
      if (!bootstrap || !output.messages?.length) return;

      const firstUser = output.messages.find((m) => m.info?.role === 'user');
      if (!firstUser?.parts?.length) return;

      if (firstUser.parts.some((p) => p.type === 'text' && typeof p.text === 'string' && p.text.includes('EXTREMELY_IMPORTANT'))) return;

      let planGate = '';
      let execContext = '';

      try {
        const workspaceRoot = findProjectRoot();
        if (workspaceRoot) {
          const userParts = firstUser.parts as Array<{ type: string; text?: string }>;
          const userText = userParts
            .filter((p) => p.type === 'text' && typeof p.text === 'string')
            .map((p) => p.text as string)
            .join(' ');
          const isTrivial = userText ? classifyComplexity(userText) === 'trivial' : false;
          planGate = isTrivial ? '' : (getPlanGate(workspaceRoot) || '');
          const index = readPlanIndex(workspaceRoot);
          if (index?.activePlanId) {
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

      let compactionAdvisory = '';
      try {
        const allText = collectMessageText(output.messages || []);
        if (allText) {
          const sessionID = _modelName || 'default';
          const decision = evaluateCompactionPolicy({
            sessionID,
            promptText: allText,
          });
          rememberCompactionState(sessionID, decision.state);
          compactionAdvisory = decision.advisory;
        }
      } catch {
        // non-fatal
      }
      if (compactionAdvisory) {
        fullBootstrap += '\n\n' + compactionAdvisory + '\n';
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
