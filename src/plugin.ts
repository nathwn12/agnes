import type { Plugin } from '@opencode-ai/plugin';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getBootstrapContent,
  buildBootstrap,
  getBootstrapPackageInfo,
} from './bootstrap.js';
import {
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
import { getPlanGate, getPlanGateFromIndex, buildExecutionContext, classifyPlannerRoute } from './runtime.js';
import { serializeAgnesMessage } from './protocol.js';
import {
  buildCompactionContext,
  detectProject,
} from './plugin-support.js';
import type { ProjectProfile } from './plugin-support.js';
import * as logger from './logger.js';
import {
  collectMessageText,
  evaluateCompactionPolicy,
  rememberCompactionState,
} from './compaction.js';
import { DelegationManager } from './orchestration/manager.js';
import {
  createDelegateTaskTool,
  createGetTaskResultTool,
  createListTasksTool,
  createListAgentsTool,
  createCancelTaskTool,
} from './orchestration/tools.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillsDir = path.resolve(__dirname, '../skills');

let _plannerMode: 'auto' | 'builtin' | 'full' = 'auto';
const _injectedSessions = new Set<string>();

function buildStructuredBootstrap(
  planner?: PlannerRoutingContext,
  workspaceRoot?: string,
  index?: PlanIndex | null,
): string {
  const proseBootstrap = getBootstrapContent(planner, workspaceRoot, index);
  if (!proseBootstrap) return '';

  const pkg = getBootstrapPackageInfo();
  const structuredBlocks = buildBootstrap({
    pkg,
    index: index ?? null,
    planner,
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

  const delegationManager = new DelegationManager(client);

  return {
    tool: {
      delegate_task: createDelegateTaskTool(delegationManager),
      get_task_result: createGetTaskResultTool(),
      list_tasks: createListTasksTool(),
      list_agents: createListAgentsTool(),
      cancel_task: createCancelTaskTool(),
    },
    config: async (config: Record<string, unknown>) => {
      const configObj = config as Record<string, unknown>;

      const plannerConfig = (configObj.planner as Record<string, unknown> | undefined) ?? {};
      _plannerMode = typeof plannerConfig.mode === 'string' && ['auto', 'builtin', 'full'].includes(plannerConfig.mode)
        ? plannerConfig.mode as 'auto' | 'builtin' | 'full'
        : 'auto';
      configObj.planner = {
        ...plannerConfig,
        mode: _plannerMode,
      } as Record<string, unknown>;

      const skillsConfig = configObj.skills as { paths?: string[] } | undefined;
      const existingPaths = skillsConfig?.paths ? [...skillsConfig.paths] : [];
      const allPaths = [...new Set([
        ...existingPaths,
        skillsDir,
        ...discoverSkills(worktreePath),
      ])];
      configObj.skills = { ...(configObj.skills as Record<string, unknown> || {}), paths: allPaths };

      configObj.agent = (configObj.agent || {}) as Record<string, unknown>;

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
    },

    'session.created': async (_event: any) => {
      projectProfile = detectProject(worktreePath);
      try {
        await client.app.log({ body: { service: 'agnes', level: 'info' as const, message: `Session started — AGNES v${getBootstrapPackageInfo().version} active` } });
      } catch (err) {
        logger.warn('Failed to log session start', err);
      }
    },

    'tool.definition': async (_input, _output) => {
      // no-op — routing handled by bootstrap
    },

    'file.edited': async (event: { path: string }) => {
      editedFiles.add(event.path);
    },

    'tool.execute.after': async (input: { tool: string; args?: Record<string, unknown> }, _output: unknown) => {
      const filePath = input.args?.filePath as string | undefined;
      if ((input.tool === 'edit' || input.tool === 'write') && filePath) {
        editedFiles.add(filePath);
      }
    },

    'session.deleted': async () => {
      editedFiles.clear();
      projectProfile = null;
      _injectedSessions.clear();
    },

    'experimental.chat.messages.transform': async (_input, output) => {
      if (!output.messages?.length) return;

      const firstUser = output.messages.find((m) => m.info?.role === 'user');
      if (!firstUser?.parts?.length) return;

      if (firstUser.parts.some((p) => p.type === 'text' && typeof p.text === 'string' && p.text.includes('EXTREMELY_IMPORTANT'))) return;
      if (firstUser.parts.some((p) => p.type === 'agent')) return;

      const injectionSessionID = (firstUser.parts[0] as { sessionID?: string }).sessionID ?? '';
      if (injectionSessionID && _injectedSessions.has(injectionSessionID)) return;
      if (injectionSessionID) _injectedSessions.add(injectionSessionID);

      let planGate = '';
      let execContext = '';
      let plannerState: PlannerRoutingContext | undefined;

      try {
        const workspaceRoot = findProjectRoot();
        let index = workspaceRoot ? readPlanIndex(workspaceRoot) : null;

        if (workspaceRoot) {
          const userParts = firstUser.parts as Array<{ type: string; text?: string }>;
          const userText = userParts
            .filter((p) => p.type === 'text' && typeof p.text === 'string')
            .map((p) => p.text as string)
            .join(' ');

          if (userText) {
            plannerState = classifyPlannerRoute(userText, _plannerMode);
            if (plannerState.route === 'builtin') {
              if (!index || !index.activePlanId) {
                createBuiltinPlan({ goal: userText, source: 'user' }, workspaceRoot);
                index = readPlanIndex(workspaceRoot);
                planGate = getPlanGate(workspaceRoot) || '';
              } else {
                planGate = getPlanGateFromIndex(index) || '';
              }
            } else if (plannerState.route === 'full') {
              planGate = index ? (getPlanGateFromIndex(index) || '') : (getPlanGate(workspaceRoot) || '');
            }
          }

          const currentIndex = index;
          if (currentIndex?.activePlanId) {
            const activeEntry = currentIndex.plans.find(p => p.id === currentIndex.activePlanId);
            if (activeEntry) {
              execContext = buildExecutionContext(activeEntry);
            }
          }
        }

        const bootstrap = buildStructuredBootstrap(plannerState, workspaceRoot ?? undefined, index);
        if (!bootstrap) return;

        let fullBootstrap = bootstrap + (planGate || '');

        if (execContext) {
          fullBootstrap += `\n\n## Execution Context\n${execContext}\n`;
        }

        let compactionAdvisory = '';
        try {
          const allText = collectMessageText(output.messages || []);
          if (allText) {
            const compactionSessionID = injectionSessionID || 'default';
            const decision = evaluateCompactionPolicy({
              sessionID: compactionSessionID,
              promptText: allText,
            });
            rememberCompactionState(compactionSessionID, decision.state);
            compactionAdvisory = decision.advisory;
          }
        } catch (err) {
          logger.warn('Failed to evaluate compaction policy', err);
        }
        if (compactionAdvisory) {
          fullBootstrap += '\n\n' + compactionAdvisory + '\n';
        }

        fullBootstrap += `\n\n## Completion Protocol\nWhen all tasks are complete, place this HTML comment at the very end of your response (invisible to users, parsed by AGNES):\n${serializeAgnesMessage({type:'completion',id:randomUUID(),timestamp:new Date().toISOString(),status:'DONE',summary:'all tasks completed successfully'})}\nFor partial results:\n${serializeAgnesMessage({type:'result',taskId:'task-000',id:randomUUID(),timestamp:new Date().toISOString(),status:'DONE',content:'...',artifact:{}})}\n`;

        const messageID = (firstUser.parts[0] as { messageID?: string }).messageID ?? '';
        firstUser.parts.unshift({
          id: randomUUID(),
          sessionID: injectionSessionID,
          messageID,
          type: 'text',
          text: fullBootstrap,
        });
      } catch (err) {
        logger.warn('Failed to build bootstrap', err);
      }
    },

    'experimental.session.compacting': async (_input: any, output: any) => {
      const pkg = getBootstrapPackageInfo();
      for (const line of buildCompactionContext({ pkg, projectProfile, editedFiles })) {
        output.context.push(line);
      }
    },
  };
};
