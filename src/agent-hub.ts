import { discoverAgents, discoverCommands, discoverSkills } from './discovery.js';
import type { AgentDiscovery, CommandDiscovery } from './discovery.js';

export type HubSource = 'agnes' | 'global' | 'workspace';

export interface AgentHubEntry {
  type: 'agent';
  name: string;
  description: string;
  source: HubSource;
  permission?: Record<string, unknown>;
  delegatable: boolean;
}

export interface CommandHubEntry {
  type: 'command';
  name: string;
  description: string;
  source: HubSource;
  agent?: string;
  subtask?: boolean;
}

export interface SkillHubEntry {
  type: 'skill';
  name: string;
  source: HubSource;
  path: string;
}

export interface AgentHub {
  agents: AgentHubEntry[];
  commands: CommandHubEntry[];
  skills: SkillHubEntry[];
}

const DELEGATABLE_NAMES = new Set(['explore', 'build', 'plan', 'general']);

function agentNameFromPath(skillPath: string): string {
  return skillPath.split(/[/\\]/).filter(Boolean).pop() || path.basename(skillPath);
}

import * as path from 'node:path';

export function discoverAgentHub(worktreePath: string): AgentHub {
  const rawAgents = discoverAgents(worktreePath);
  const rawCommands = discoverCommands(worktreePath);
  const rawSkillPaths = discoverSkills(worktreePath);

  const agents: AgentHubEntry[] = rawAgents.map((a: AgentDiscovery) => ({
    type: 'agent' as const,
    name: a.name,
    description: a.desc,
    source: a.source,
    permission: a.permission as Record<string, unknown> | undefined,
    delegatable: DELEGATABLE_NAMES.has(a.name),
  }));

  const commands: CommandHubEntry[] = rawCommands.map((c: CommandDiscovery) => ({
    type: 'command' as const,
    name: c.name,
    description: c.desc,
    source: c.source,
    agent: c.agent,
    subtask: c.subtask,
  }));

  const skills: SkillHubEntry[] = rawSkillPaths.map((sp: string) => ({
    type: 'skill' as const,
    name: agentNameFromPath(sp),
    source: inferSkillSource(sp, worktreePath),
    path: sp,
  }));

  return { agents, commands, skills };
}

function inferSkillSource(skillPath: string, _worktreePath: string): HubSource {
  const normal = skillPath.replace(/\\/g, '/');
  const worktree = _worktreePath.replace(/\\/g, '/');
  if (normal.startsWith(worktree + '/.opencode/skills/')) return 'workspace';
  if (normal.includes('.config/opencode/skills/')) return 'global';
  return 'agnes';
}

export function formatHubSummary(hub: AgentHub): string {
  const lines: string[] = ['## Agent Hub Catalog', ''];

  lines.push(`**Agents** (${hub.agents.length})`);
  if (hub.agents.length > 0) {
    lines.push('| Name | Source | Delegatable | Description |');
    lines.push('|------|--------|:-----------:|-------------|');
    for (const a of hub.agents) {
      const del = a.delegatable ? 'yes' : 'no';
      lines.push(`| ${a.name} | ${a.source} | ${del} | ${a.description} |`);
    }
  } else {
    lines.push('_(none discovered)_');
  }
  lines.push('');

  lines.push(`**Commands** (${hub.commands.length})`);
  if (hub.commands.length > 0) {
    lines.push('| Name | Source | Delegates To | Description |');
    lines.push('|------|--------|:-----------:|-------------|');
    for (const c of hub.commands) {
      const agent = c.agent || '-';
      lines.push(`| ${c.name} | ${c.source} | ${agent} | ${c.description} |`);
    }
  } else {
    lines.push('_(none discovered)_');
  }
  lines.push('');

  lines.push(`**Skills** (${hub.skills.length})`);
  if (hub.skills.length > 0) {
    lines.push('| Name | Source |');
    lines.push('|------|--------|');
    for (const s of hub.skills) {
      lines.push(`| ${s.name} | ${s.source} |`);
    }
  } else {
    lines.push('_(none discovered)_');
  }
  lines.push('');

  return lines.join('\n');
}
