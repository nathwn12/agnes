import * as os from 'node:os';

export type ShellType = 'git-bash' | 'pwsh' | 'powershell' | 'cmd' | 'wsl' | 'unix' | 'unknown';

export interface ShellEnvironment {
  shellType: ShellType;
  preferredSyntax: 'bash' | 'powershell' | 'cmd';
  isWindows: boolean;
  isPowerShell: boolean;
  antiPatterns: string[];
  guidance: string;
  source: string;
}

const ANTI_PATTERNS: Record<ShellType, string[]> = {
  'git-bash': ['Remove-Item', 'Get-ChildItem', 'New-Item', 'Set-Content', 'PowerShell', 'powershell', 'Get-Content', 'Out-File', 'Move-Item', 'Copy-Item', 'Write-Output', 'Invoke-WebRequest', 'ForEach-Object', 'Where-Object', 'Select-Object'],
  'pwsh': ['Get-Content', 'Set-Content', 'Out-File', 'Add-Content', 'Get-ChildItem', 'Select-String', 'Remove-Item'],
  'powershell': ['Get-Content', 'Set-Content', 'Out-File', 'Add-Content', 'Get-ChildItem', 'Select-String', 'Remove-Item'],
  'cmd': [],
  'wsl': ['Remove-Item', 'Get-ChildItem'],
  'unix': [],
  'unknown': [],
};

const GUIDANCE: Record<ShellType, string> = {
  'git-bash': 'You are running on Git Bash (MSYS2/MinGW). Use POSIX/bash commands (ls, rm, mkdir, cat, echo). NEVER use PowerShell commands like Remove-Item, Get-ChildItem, or Set-Content.',
  'pwsh': 'You are running on PowerShell 7+ (pwsh). Use PowerShell cmdlets and syntax.',
  'powershell': 'You are running on Windows PowerShell 5.1 (powershell.exe). Use PowerShell cmdlets and syntax.',
  'cmd': 'You are running on Windows Command Prompt (CMD). Use cmd.exe syntax.',
  'wsl': 'You are running on WSL (Windows Subsystem for Linux). Use bash commands.',
  'unix': 'You are running on a Unix/Linux/macOS shell. Use standard POSIX/bash commands.',
  'unknown': 'Shell type could not be determined. Use standard POSIX/bash commands.',
};

let _cachedShell: ShellEnvironment | null = null;

export function resetShellCache(): void {
  _cachedShell = null;
}

export function detectShell(): ShellEnvironment {
  if (_cachedShell) return _cachedShell;

  const env = process.env;
  const platform = os.platform();
  const isWindows = platform === 'win32';

  let shellType: ShellType;
  let source: string;

  if (env.MSYSTEM) {
    shellType = 'git-bash';
    source = 'MSYSTEM';
  } else if (env.PSModulePath && !env.MSYSTEM) {
    if (env.PSEdition === 'Core') {
      shellType = 'pwsh';
      source = 'PSEdition';
    } else {
      shellType = isWindows ? 'powershell' : 'unknown';
      source = 'PSModulePath';
    }
  } else if (env.ComSpec?.toLowerCase().includes('cmd.exe') && !env.SHELL?.toLowerCase().includes('bash')) {
    shellType = 'cmd';
    source = 'ComSpec';
  } else if (env.SHELL) {
    const shellLower = env.SHELL.toLowerCase();
    if (shellLower.includes('bash') || shellLower.includes('zsh') || shellLower.includes('sh')) {
      shellType = isWindows ? 'wsl' : 'unix';
      source = 'SHELL';
    } else {
      shellType = 'unknown';
      source = 'SHELL';
    }
  } else if (isWindows) {
    if (env.PSEdition === 'Core') {
      shellType = 'pwsh';
      source = 'platform+PSEdition';
    } else {
      shellType = 'powershell';
      source = 'platform';
    }
  } else {
    shellType = 'unix';
    source = 'platform';
  }

  const isPowerShell = shellType === 'pwsh' || shellType === 'powershell';
  const preferredSyntax = shellType === 'git-bash' || shellType === 'wsl' || shellType === 'unix'
    ? 'bash'
    : shellType === 'pwsh' || shellType === 'powershell'
    ? 'powershell'
    : 'cmd';

  _cachedShell = {
    shellType,
    preferredSyntax,
    isWindows,
    isPowerShell,
    antiPatterns: ANTI_PATTERNS[shellType],
    guidance: GUIDANCE[shellType],
    source,
  };

  return _cachedShell;
}
