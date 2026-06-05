import type { Plugin } from '@opencode-ai/plugin';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getBootstrapContent,
  getBootstrapPackageInfo,
} from './bootstrap.js';
import {
  discoverAgents,
  discoverCommands,
  discoverSkills,
} from './discovery.js';
import { discoverAgentHub, formatHubSummary } from './agent-hub.js';
import { serializeAgnesMessage } from './protocol.js';
import {
  buildCompactionContext,
  detectProject,
} from './plugin-support.js';
import type { ProjectProfile } from './plugin-support.js';
import * as logger from './logger.js';

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

export const AgnesPlugin: Plugin = async ({ directory, worktree }) => {
  const worktreePath = worktree || directory;
  const editedFiles = new Set<string>();
  let projectProfile: ProjectProfile | null = null;

  return {
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

    'tool.definition': async () => {},

    'file.edited': async (event: { path: string }) => {
      editedFiles.add(event.path);
    },

    'tool.execute.after': async (input: { tool: string; args?: Record<string, unknown> }, _output: unknown) => {
      const filePath = input.args?.filePath as string | undefined;
      if ((input.tool === 'edit' || input.tool === 'write') && filePath) {
        editedFiles.add(filePath);
      }
    },

    'session.deleted': async (_event: any) => {
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

      try {
        const bootstrap = getBootstrapContent();
        if (!bootstrap) return;

        let fullBootstrap = bootstrap;

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
