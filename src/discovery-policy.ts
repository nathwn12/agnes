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


