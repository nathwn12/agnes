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
  discoverAgents,
  discoverCommands,
  discoverSkills,
} from './discovery.js';
import { discoverAgentHub, formatHubSummary } from './agent-hub.js';
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
import { OrchestratorManager } from './orchestration/manager.js';
import {
  createDelegateTaskTool,
  createGetTaskResultTool,
  createCancelTaskTool,
} from './orchestration/tools.js';
import { cleanupSession as cleanupReturns } from './orchestration/returns.js';
import { storeNamedResult, registerPendingParent } from './orchestration/session.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillsDir = path.resolve(__dirname, '../skills');

let _plannerMode: 'auto' | 'builtin' | 'full' = 'auto';
const _injectedSessions = new Set<string>();

function getAgentTools(name: string): Record<string, boolean> {
  const readonly = ["reviewer", "planner", "architect", "lookup"].some(p => name.includes(p));
  return readonly
    ? { read: true, bash: true }
    : { read: true, write: true, edit: true, bash: true };
}

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

  const orchestratorManager = new OrchestratorManager(client);

  return {
    tool: {
      delegate_task: createDelegateTaskTool(orchestratorManager),
      get_task_result: createGetTaskResultTool(orchestratorManager),
      cancel_task: createCancelTaskTool(orchestratorManager),
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

      const existingAgents = (configObj.agent || {}) as Record<string, unknown>;
      for (const agent of discoverAgents(worktreePath)) {
        if (!existingAgents[agent.name]) {
          existingAgents[agent.name] = {
            description: agent.desc,
            prompt: agent.prompt,
            mode: "subagent",
            tools: getAgentTools(agent.name),
          };
        }
      }
      configObj.agent = existingAgents;

      const hub = discoverAgentHub(worktreePath);
      const hubSummary = formatHubSummary(hub);

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
      if (!cmdCfgObj['agent-hub']) {
        cmdCfgObj['agent-hub'] = {
          description: 'List all discovered agents, skills, and commands from the Agent Hub catalog',
          template: `Present the following Agent Hub catalog as a formatted summary:\n\n${hubSummary}\n\nGroup by type and source, highlight delegatable agents.`,
        };
      }
      configObj.command = cmdCfgObj;
    },

    'session.created': async (_event: any) => {
      projectProfile = detectProject(worktreePath);
    },

    'tool.definition': async (_input, _output) => {
      // no-op — routing handled by bootstrap
    },

    'file.edited': async (event: { path: string }) => {
      editedFiles.add(event.path);
    },

    'tool.execute.before': async (input: { tool: string; args?: Record<string, unknown> }, _output: unknown) => {
      // Race-safe parent mapping: when a subtask spawns another subtask,
      // capture the parent session mapping by prompt content before the tool executes
      if (input.tool === 'delegate_task') {
        const prompt = input.args?.prompt as string | undefined;
        if (prompt) {
          const parentSessionID = (_output as any)?.sessionID ?? '';
          if (parentSessionID) {
            registerPendingParent(prompt, parentSessionID);
          }
        }
      }
    },

    'tool.execute.after': async (input: { tool: string; args?: Record<string, unknown> }, _output: unknown) => {
      const filePath = input.args?.filePath as string | undefined;
      if ((input.tool === 'edit' || input.tool === 'write') && filePath) {
        editedFiles.add(filePath);
      }

      // Capture $RESULT[name] from completed background tasks
      if (input.tool === 'get_task_result') {
        const taskId = input.args?.taskId as string | undefined;
        if (taskId) {
          const task = orchestratorManager.getTask(taskId);
          if (task?.result) {
            storeNamedResult(task.parentSessionID, taskId, task.result);
          }
        }
      }
    },

    'session.deleted': async (_event: any) => {
      editedFiles.clear();
      projectProfile = null;
      _injectedSessions.clear();
      const sessionID = typeof _event === 'object' && _event ? ((_event as Record<string, unknown>).sessionID as string ?? '') : '';
      if (sessionID) cleanupReturns(sessionID);
    },

    event: async ({ event }: { event: { type: string; sessionID?: string; properties?: Record<string, unknown> } }) => {
      const sid = event.sessionID ?? (event.properties?.sessionID as string) ?? '';
      if (event.type === 'session.idle' && sid) {
        const { handleSessionIdle } = await import('./orchestration/idle-handler.js');
        handleSessionIdle(sid, client.session as any).catch(err => {
          logger.warn('session.idle handler failed', err);
        });
      }
    },

    'experimental.chat.messages.transform': async (_input, output) => {
      // Run message transform pipeline first (summary filtering, return injection, loop eval)
      const { chatMessagesTransform } = await import('./orchestration/message-transform.js');
      await chatMessagesTransform(_input, output);

      // Then fall through to original bootstrap injection
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
