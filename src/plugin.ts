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
import {
  discoverAgents,
  discoverCommands,
  discoverSkills,
} from './discovery.js';
import type { PlanIndex } from './state.js';
import {
  findProjectRoot,
  readPlanIndex,
  createBuiltinPlan,
} from './state.js';
import type { PlannerRoutingContext } from './state.js';
import { getPlanGate, buildExecutionContext, classifyPlannerRoute } from './runtime.js';
import { serializeAgnesMessage } from './protocol.js';
import {
  applyModelRouting,
  loadModelRoutingConfig,
  getConfigPath,
  writeConfig,
  populateAgentList,
} from './model-routing.js';
import {
  buildCompactionContext,
  detectProject,
} from './plugin-support.js';
import type { ProjectProfile } from './plugin-support.js';

import * as logger from './logger.js';
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
  } catch (err) {
    logger.warn('Failed to read plan index for bootstrap', err);
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

export const AgnesPlugin: Plugin = async ({ client, directory, worktree }) => {
  const worktreePath = worktree || directory;
  const editedFiles = new Set<string>();
  let projectProfile: ProjectProfile | null = null;
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
      const existingPaths = skillsConfig?.paths ? [...skillsConfig.paths] : [];
      const allPaths = [...new Set([
        ...existingPaths,
        skillsDir,
        ...discoverSkills(worktreePath),
      ])];
      configObj.skills = { ...(configObj.skills as Record<string, unknown> || {}), paths: allPaths };

      const agentCfgObj = (configObj.agent || {}) as Record<string, unknown>;
      for (const agent of discoverAgents(worktreePath)) {
        if (!agentCfgObj[agent.name]) {
          const agentCfg: Record<string, unknown> = { description: agent.desc, mode: "subagent", prompt: agent.prompt };
          if (agent.permission) agentCfg.permission = agent.permission;
          agentCfgObj[agent.name] = agentCfg;
        }
      }
      configObj.agent = agentCfgObj;

      const cmdCfgObj = (configObj.command || {}) as Record<string, unknown>;
      for (const cmd of discoverCommands(worktreePath)) {
        if (!cmdCfgObj[cmd.name]) {
          cmdCfgObj[cmd.name] = {
            description: cmd.desc,
            template: `${cmd.template}\n\n$ARGUMENTS`,
            ...(cmd.agent ? { agent: cmd.agent } : {}),
            ...(cmd.subtask ? { subtask: true } : {}),
          };
        }
      }
      configObj.command = cmdCfgObj;
      // ── Model Routing (Win #3) ─────────────────────────────────────
      const routing = loadModelRoutingConfig();
      const agentNames = Object.keys((configObj.agent || {}) as Record<string, unknown>);
      const populated = populateAgentList(routing, agentNames);
      writeConfig(getConfigPath(), populated);
      applyModelRouting(configObj, populated);
    },

    "session.created": async (_event: any) => {
      projectProfile = detectProject(worktreePath);
      try { await client.app.log({ body: { service: "agnes", level: "info" as const, message: `Session started — AGNES v${getBootstrapPackageInfo().version} active` } }); } catch (err) { logger.warn('Failed to log session start', err); }
    },

    "chat.message": async (input) => {
      if (input.model?.modelID && typeof input.model.modelID === 'string') {
        _modelName = input.model.modelID;
      }
    },

    "tool.definition": async (input, output) => {
      if (input.toolID === 'edit' || input.toolID === 'write' || input.toolID === 'apply_patch') {
        output.description = `!!! AGNES ENFORCEMENT !!! MUTATION tool — must delegate to @builder. VIOLATION = BUG. | ${output.description}`;
      }
      if (input.toolID === 'glob' || input.toolID === 'grep') {
        output.description = `[AGNES ENFORCEMENT] Read-only tool — safe in main context. Prefer @explorer for complex searches. | ${output.description}`;
      }
      if (input.toolID === 'bash') {
        output.description = `!!! AGNES ENFORCEMENT !!! MUTATION tool — must delegate to @executor. VIOLATION = BUG. | ${output.description}`;
      }
    },

    "file.edited": async (event: { path: string }) => {
      editedFiles.add(event.path);
    },

    "tool.execute.after": async (input: { tool: string; args?: Record<string, unknown> }, _output: unknown) => {
      const filePath = input.args?.filePath as string | undefined;
      if ((input.tool === "edit" || input.tool === "write") && filePath) {
        editedFiles.add(filePath);
      }
    },

    "session.deleted": async () => {
      editedFiles.clear();
      projectProfile = null;
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
      } catch (err) {
        logger.warn('Failed to build plan gate', err);
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
      } catch (err) {
        logger.warn('Failed to evaluate compaction policy', err);
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

    "experimental.session.compacting": async (_input: any, output: any) => {
      const pkg = getBootstrapPackageInfo();
      for (const line of buildCompactionContext({ pkg, projectProfile, editedFiles })) {
        output.context.push(line);
      }
    },
  };
};
