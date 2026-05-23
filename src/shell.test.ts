import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { detectShell, resetShellCache } from './shell.js';

let _mockPlatform: string = 'win32';

mock.module('node:os', () => ({
  platform: () => _mockPlatform,
}));

const OLD_ENV = { ...process.env };

beforeEach(() => {
  resetShellCache();
  process.env = {};
  _mockPlatform = 'win32';
});

afterEach(() => {
  process.env = OLD_ENV;
});

describe('detectShell - Git Bash', () => {
  test('MSYSTEM=MINGW64', () => {
    process.env.MSYSTEM = 'MINGW64';
    const r = detectShell();
    expect(r.shellType).toBe('git-bash');
    expect(r.preferredSyntax).toBe('bash');
    expect(r.isWindows).toBe(true);
    expect(r.isPowerShell).toBe(false);
    expect(r.source).toBe('MSYSTEM');
    expect(r.antiPatterns.length).toBeGreaterThan(0);
    expect(r.antiPatterns).toContain('Remove-Item');
    expect(r.guidance.includes('Git Bash')).toBe(true);
  });

  test('MSYSTEM=MINGW32', () => {
    process.env.MSYSTEM = 'MINGW32';
    const r = detectShell();
    expect(r.shellType).toBe('git-bash');
    expect(r.source).toBe('MSYSTEM');
  });

  test('MSYSTEM=MSYS', () => {
    process.env.MSYSTEM = 'MSYS';
    const r = detectShell();
    expect(r.shellType).toBe('git-bash');
    expect(r.source).toBe('MSYSTEM');
  });
});

describe('detectShell - PowerShell', () => {
  test('PowerShell on Windows', () => {
    process.env.PSModulePath = 'C:\\Modules';
    const r = detectShell();
    expect(r.shellType).toBe('powershell');
    expect(r.preferredSyntax).toBe('powershell');
    expect(r.isWindows).toBe(true);
    expect(r.isPowerShell).toBe(true);
    expect(r.source).toBe('PSModulePath');
    expect(r.antiPatterns).toEqual([]);
  });

  test('PSModulePath on non-Windows returns unknown', () => {
    process.env.PSModulePath = '/usr/share/modules';
    _mockPlatform = 'linux';
    const r = detectShell();
    expect(r.shellType).toBe('unknown');
    expect(r.preferredSyntax).toBe('cmd');
    expect(r.isWindows).toBe(false);
    expect(r.isPowerShell).toBe(false);
    expect(r.source).toBe('PSModulePath');
  });
});

describe('detectShell - CMD', () => {
  test('ComSpec set, no conflicting env', () => {
    process.env.ComSpec = 'C:\\Windows\\System32\\cmd.exe';
    const r = detectShell();
    expect(r.shellType).toBe('cmd');
    expect(r.preferredSyntax).toBe('cmd');
    expect(r.source).toBe('ComSpec');
    expect(r.antiPatterns).toEqual([]);
  });

  test('ComSpec set, SHELL does not contain bash', () => {
    process.env.ComSpec = 'C:\\Windows\\System32\\cmd.exe';
    process.env.SHELL = '/usr/bin/tcsh';
    const r = detectShell();
    expect(r.shellType).toBe('cmd');
    expect(r.source).toBe('ComSpec');
  });

  test('ComSpec with SHELL=/usr/bin/bash falls through to WSL', () => {
    process.env.ComSpec = 'C:\\Windows\\System32\\cmd.exe';
    process.env.SHELL = '/usr/bin/bash';
    const r = detectShell();
    expect(r.shellType).toBe('wsl');
    expect(r.preferredSyntax).toBe('bash');
    expect(r.source).toBe('SHELL');
  });
});

describe('detectShell - WSL', () => {
  test('SHELL=/bin/bash on Windows', () => {
    process.env.SHELL = '/bin/bash';
    const r = detectShell();
    expect(r.shellType).toBe('wsl');
    expect(r.preferredSyntax).toBe('bash');
    expect(r.isWindows).toBe(true);
    expect(r.isPowerShell).toBe(false);
    expect(r.source).toBe('SHELL');
    expect(r.antiPatterns).toContain('Remove-Item');
    expect(r.guidance.includes('WSL')).toBe(true);
  });

  test('SHELL=/bin/zsh on Windows', () => {
    process.env.SHELL = '/bin/zsh';
    const r = detectShell();
    expect(r.shellType).toBe('wsl');
    expect(r.source).toBe('SHELL');
  });

  test('SHELL=/bin/sh on Windows', () => {
    process.env.SHELL = '/bin/sh';
    const r = detectShell();
    expect(r.shellType).toBe('wsl');
    expect(r.source).toBe('SHELL');
  });
});

describe('detectShell - Unix/Mac', () => {
  test('SHELL=/bin/zsh on macOS', () => {
    process.env.SHELL = '/bin/zsh';
    _mockPlatform = 'darwin';
    const r = detectShell();
    expect(r.shellType).toBe('unix');
    expect(r.preferredSyntax).toBe('bash');
    expect(r.isWindows).toBe(false);
    expect(r.source).toBe('SHELL');
    expect(r.antiPatterns).toEqual([]);
  });

  test('SHELL=/bin/bash on Linux', () => {
    process.env.SHELL = '/bin/bash';
    _mockPlatform = 'linux';
    const r = detectShell();
    expect(r.shellType).toBe('unix');
    expect(r.source).toBe('SHELL');
  });

  test('SHELL=/bin/sh on Linux', () => {
    process.env.SHELL = '/bin/sh';
    _mockPlatform = 'linux';
    const r = detectShell();
    expect(r.shellType).toBe('unix');
    expect(r.source).toBe('SHELL');
  });
});

describe('detectShell - unknown shell', () => {
  test('SHELL set to unrecognized value', () => {
    process.env.SHELL = '/usr/bin/python3';
    _mockPlatform = 'linux';
    const r = detectShell();
    expect(r.shellType).toBe('unknown');
    expect(r.preferredSyntax).toBe('cmd');
    expect(r.source).toBe('SHELL');
  });
});

describe('detectShell - platform fallback', () => {
  test('No env vars on Windows => powershell', () => {
    const r = detectShell();
    expect(r.shellType).toBe('powershell');
    expect(r.preferredSyntax).toBe('powershell');
    expect(r.source).toBe('platform');
  });

  test('No env vars on macOS => unix', () => {
    _mockPlatform = 'darwin';
    const r = detectShell();
    expect(r.shellType).toBe('unix');
    expect(r.preferredSyntax).toBe('bash');
    expect(r.source).toBe('platform');
  });

  test('No env vars on Linux => unix', () => {
    _mockPlatform = 'linux';
    const r = detectShell();
    expect(r.shellType).toBe('unix');
    expect(r.source).toBe('platform');
  });

  test('No env vars on Android => unix (else branch)', () => {
    _mockPlatform = 'android';
    const r = detectShell();
    expect(r.shellType).toBe('unix');
    expect(r.source).toBe('platform');
  });
});

describe('detectShell caching', () => {
  test('cached result returned after first call', () => {
    const r1 = detectShell();
    expect(r1.shellType).toBe('powershell');

    process.env.MSYSTEM = 'MINGW64';
    const r2 = detectShell();
    expect(r2).toBe(r1);
    expect(r2.shellType).toBe('powershell');
  });

  test('resetShellCache clears cached result', () => {
    const r1 = detectShell();
    expect(r1.shellType).toBe('powershell');

    process.env.MSYSTEM = 'MINGW64';
    resetShellCache();
    const r2 = detectShell();
    expect(r2.shellType).toBe('git-bash');
    expect(r2.source).toBe('MSYSTEM');
  });
});

describe('ShellEnvironment structure', () => {
  const shellTypes: Array<{ env: Record<string, string>; platform?: string }> = [
    { env: { MSYSTEM: 'MINGW64' } },
    { env: { PSModulePath: 'C:\\Modules' } },
    { env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' } },
    { env: { SHELL: '/bin/bash' } },
    { env: { SHELL: '/bin/bash' }, platform: 'linux' },
    { env: { SHELL: '/usr/bin/python3' }, platform: 'linux' },
  ];

  for (const { env, platform } of shellTypes) {
    const label = Object.keys(env)[0] + '=' + Object.values(env)[0] + (platform ? ' on ' + platform : '');
    test(`structure for ${label}`, () => {
      if (platform) _mockPlatform = platform;
      Object.assign(process.env, env);
      resetShellCache();
      const r = detectShell();
      expect(['git-bash', 'powershell', 'cmd', 'wsl', 'unix', 'unknown']).toContain(r.shellType);
      expect(['bash', 'powershell', 'cmd']).toContain(r.preferredSyntax);
      expect(typeof r.isWindows).toBe('boolean');
      expect(typeof r.isPowerShell).toBe('boolean');
      expect(Array.isArray(r.antiPatterns)).toBe(true);
      expect(typeof r.guidance).toBe('string');
      expect(typeof r.source).toBe('string');
      expect(r.source.length).toBeGreaterThan(0);
    });
  }
});

describe('anti-patterns per shell type', () => {
  test('git-bash has PowerShell anti-patterns', () => {
    process.env.MSYSTEM = 'MINGW64';
    const r = detectShell();
    expect(r.antiPatterns).toEqual([
      'Remove-Item', 'Get-ChildItem', 'New-Item', 'Set-Content',
      'PowerShell', 'powershell', 'Get-Content', 'Out-File',
      'Move-Item', 'Copy-Item', 'Write-Output', 'Invoke-WebRequest',
      'ForEach-Object', 'Where-Object', 'Select-Object',
    ]);
  });

  test('powershell has empty anti-patterns', () => {
    process.env.PSModulePath = 'C:\\Modules';
    const r = detectShell();
    expect(r.antiPatterns).toEqual([]);
  });

  test('cmd has empty anti-patterns', () => {
    process.env.ComSpec = 'C:\\Windows\\System32\\cmd.exe';
    const r = detectShell();
    expect(r.antiPatterns).toEqual([]);
  });

  test('wsl has specific anti-patterns', () => {
    process.env.SHELL = '/bin/bash';
    const r = detectShell();
    expect(r.antiPatterns).toEqual(['Remove-Item', 'Get-ChildItem']);
  });

  test('unix has empty anti-patterns', () => {
    process.env.SHELL = '/bin/bash';
    _mockPlatform = 'linux';
    const r = detectShell();
    expect(r.antiPatterns).toEqual([]);
  });

  test('unknown has empty anti-patterns', () => {
    process.env.PSModulePath = '/usr/share/modules';
    _mockPlatform = 'linux';
    const r = detectShell();
    expect(r.antiPatterns).toEqual([]);
  });
});
