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
  createBuiltinPlan,
} from './state.js';
import type { PlannerRoutingContext } from './state.js';
import { getPlanGate, buildExecutionContext, classifyPlannerRoute } from './runtime.js';
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
let _plannerMode: 'auto' | 'builtin' | 'full' = 'auto';

function buildStructuredBootstrap(planner?: PlannerRoutingContext): string {
  const proseBootstrap = getBootstrapContent(planner);
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
    planner,
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

      const plannerConfig = (configObj.planner as Record<string, unknown> | undefined) ?? {};
      _plannerMode = typeof plannerConfig.mode === 'string' && ['auto', 'builtin', 'full'].includes(plannerConfig.mode)
        ? plannerConfig.mode as 'auto' | 'builtin' | 'full'
        : 'auto';
      configObj.planner = {
        ...plannerConfig,
        mode: _plannerMode,
      } as Record<string, unknown>;

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

    "tool.definition": async (input, output) => {
      if (input.toolID === 'edit' || input.toolID === 'write') {
        output.description = `[AGNES ENFORCEMENT] This tool MUST be called inside a @builder subagent, not in main context. In main context, delegate via the \`task\` tool. Rule: delegate_or_die. | ${output.description}`;
      }
      if (input.toolID === 'glob' || input.toolID === 'grep') {
        output.description = `[AGNES ENFORCEMENT] Searching the codebase must be delegated to an @explorer subagent. In main context, delegate via \`task\`. Rule: no analysis in main context. | ${output.description}`;
      }
      if (input.toolID === 'bash') {
        output.description = `[AGNES ENFORCEMENT] All commands must run inside an @executor subagent. In main context, delegate via \`task\`. Use \`task\` to spawn a subagent that runs this command. Rule: no mutating commands in main context. | ${output.description}`;
      }
      if (input.toolID === 'read') {
        output.description = `[AGNES ENFORCEMENT] File reading in main context should be limited to .agnes/ state files. For source code analysis, delegate to @explorer subagent. | ${output.description}`;
      }
      if (input.toolID === 'webfetch') {
        output.description = `[AGNES ENFORCEMENT] Use sparingly in main context. Prefer to delegate web fetching to a subagent for structured results. | ${output.description}`;
      }
      if (input.toolID === 'question') {
        output.description = `[AGNES ENFORCEMENT] OK to use in main context for asking the user clarifying questions. | ${output.description}`;
      }
      if (input.toolID === 'skill') {
        output.description = `[AGNES ENFORCEMENT] OK to use in main context to load domain-specific skills. | ${output.description}`;
      }
      if (input.toolID === 'todowrite') {
        output.description = `[AGNES ENFORCEMENT] OK to use in main context for tracking task progress. | ${output.description}`;
      }
    },

    "tool.execute.before": async (input) => {
      const restricted = new Set(['bash', 'edit', 'write', 'glob', 'grep']);
      if (restricted.has(input.tool)) {
        const messages: Record<string, string> = {
          bash: 'use @executor subagent via task',
          edit: 'use @builder subagent via task',
          write: 'use @builder subagent via task',
          glob: 'use @explorer subagent via task',
          grep: 'use @explorer subagent via task',
        };
        throw new Error(`[AGNES] ${input.tool} blocked in main context — ${messages[input.tool]}`);
      }
    },

    "experimental.chat.system.transform": async (_input, output) => {
      output.system.push(
        '',
        '=== AGNES DELEGATION ENFORCEMENT (HARD RULES) ===',
        'You are AGNES. These rules are NOT optional. They are structural constraints. Violations are bugs.',
        '',
        '1. NEVER call edit/write/glob/grep/bash in main context. These tools are FORBIDDEN here.',
        '2. ALWAYS use the `task` tool to spawn a subagent for any work.',
        '3. If you catch yourself thinking, analyzing, or planning in main context — STOP. Delegate via `task`.',
        '4. Main context is TALK + DELEGATE only. All tools except `task`, `skill`, and `read` (state only) must go through subagents.',
        '5. The `tool.definition` hook prepends warnings to work tools. Read those warnings. Obey them.',
        '=== END AGNES DELEGATION ENFORCEMENT ===',
        '',
      );
    },

    'experimental.chat.messages.transform': async (_input, output) => {
      if (!output.messages?.length) return;

      const firstUser = output.messages.find((m) => m.info?.role === 'user');
      if (!firstUser?.parts?.length) return;

      if (firstUser.parts.some((p) => p.type === 'text' && typeof p.text === 'string' && p.text.includes('EXTREMELY_IMPORTANT'))) return;

      let planGate = '';
      let execContext = '';
      let plannerState: PlannerRoutingContext | undefined;

      try {
        const workspaceRoot = findProjectRoot();
        if (workspaceRoot) {
          const userParts = firstUser.parts as Array<{ type: string; text?: string }>;
          const userText = userParts
            .filter((p) => p.type === 'text' && typeof p.text === 'string')
            .map((p) => p.text as string)
            .join(' ');
          if (userText) {
            plannerState = classifyPlannerRoute(userText, _plannerMode);
            if (plannerState.route === 'builtin') {
              const index = readPlanIndex(workspaceRoot);
              if (!index || !index.activePlanId) {
                createBuiltinPlan({ goal: userText, source: 'user' }, workspaceRoot);
              }
              planGate = getPlanGate(workspaceRoot) || '';
            } else if (plannerState.route === 'full') {
              planGate = getPlanGate(workspaceRoot) || '';
            } else {
              planGate = '';
            }
          }
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

      const bootstrap = buildStructuredBootstrap(plannerState);
      if (!bootstrap) return;

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
