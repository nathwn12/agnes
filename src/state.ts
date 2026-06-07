import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const OPENCODE_CACHE_ROOT = path.join(os.homedir(), '.cache', 'opencode', 'packages');

let _cachedProjectRoot: string | null = null;

export function resetProjectRootCache(): void {
  _cachedProjectRoot = null;
}

function isBlockedPath(dir: string): boolean {
  const resolved = path.resolve(dir);
  const root = path.resolve(OPENCODE_CACHE_ROOT);
  if (os.platform() === 'win32') {
    return resolved.toLowerCase().startsWith(root.toLowerCase());
  }
  return resolved.startsWith(root);
}

export function findProjectRoot(startDir?: string): string | null {
  if (_cachedProjectRoot && !startDir) {
    const markerPath = path.join(_cachedProjectRoot, '.opencode');
    if (fs.existsSync(markerPath)) {
      return _cachedProjectRoot;
    }
    _cachedProjectRoot = null;
  }

  let dir = startDir ? path.resolve(startDir) : process.cwd();
  for (let i = 0; i < 20; i++) {
    if (isBlockedPath(dir)) break;
    if (dir === os.homedir()) break;
    if (fs.existsSync(path.join(dir, '.opencode'))) {
      if (!startDir) _cachedProjectRoot = dir;
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}
