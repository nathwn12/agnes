export function parseCommandFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) {
      let value: unknown = kv[2].trim();
      if (value === "true") value = true;
      else if (value === "false") value = false;
      else if ((value as string).startsWith('"') && (value as string).endsWith('"')) value = (value as string).slice(1, -1);
      result[kv[1]] = value;
    }
  }
  return result;
}

export function inferAgentDesc(name: string, prompt: string): string {
  const firstLine = prompt.split("\n")[0]?.trim() || "";
  if (firstLine) {
    return firstLine.replace(/^You are an?\s+/i, "").replace(/\.$/, "");
  }
  return name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mergeByName<T extends { name: string }>(priorityGroups: T[][]): T[] {
  const seen = new Map<string, T>();
  for (const group of priorityGroups) {
    for (const item of group) {
      if (!seen.has(item.name)) {
        seen.set(item.name, item);
      }
    }
  }
  return [...seen.values()];
}
