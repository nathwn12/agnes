#!/usr/bin/env bun
import { $ } from 'bun';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');

function readPkg() {
  return JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
}

const RED = '\x1b[31m';
const GRN = '\x1b[32m';
const YLW = '\x1b[33m';
const RST = '\x1b[0m';

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--go');
  const versionOverride = args.find(a => a.startsWith('--version='));
  const pkg = readPkg();

  if (pkg.name !== 'agnes') {
    console.error(`${RED}  ✖ Not the agnes repository (package.json name: "${pkg.name}")${RST}`);
    process.exit(1);
  }

  if (!pkg.version && !versionOverride) {
    console.error(`${RED}  ✖ package.json has no version field${RST}`);
    process.exit(1);
  }

  let version: string;
  if (versionOverride) {
    const v = versionOverride.split('=')[1];
    if (!v) {
      console.error(`${RED}  ✖ --version= flag has empty value${RST}`);
      process.exit(1);
    }
    version = v;
  } else {
    version = pkg.version;
  }
  const tag = `v${version}`;

  console.log(`${YLW}\n  AGNES Release ${tag}${RST}`);
  console.log(`  Repo: ${pkg.repository || 'unknown'}`);
  console.log(isDryRun ? `${YLW}  Mode: DRY RUN (add --go to execute)${RST}\n` : `${GRN}  Mode: LIVE${RST}\n`);

  if (!isDryRun) {
    const ghCheck = await $`which gh`.quiet().nothrow();
    if (ghCheck.exitCode !== 0) {
      console.error(`${RED}  ✖ gh CLI not found. Install it from https://cli.github.com/${RST}`);
      process.exit(1);
    }
  }

  const status = (await $`git status --porcelain`.text()).trim();
  if (status) {
    console.log(`${RED}  ✖ Uncommitted changes:${RST}`);
    for (const line of status.split('\n')) console.log(`    ${line}`);
    if (!isDryRun) process.exit(1);
    console.log(`${YLW}  (would abort)${RST}`);
  } else {
    console.log(`${GRN}  ✓ Working tree clean${RST}`);
  }

  const tagExists = (await $`git tag -l "${tag}"`.text()).trim();
  if (tagExists) {
    console.log(`${RED}  ✖ Tag ${tag} already exists${RST}`);
    if (!isDryRun) process.exit(1);
    console.log(`${YLW}  (would abort)${RST}`);
  } else {
    console.log(`${GRN}  ✓ Tag ${tag} is free${RST}`);
  }

  const lastTag = (await $`git tag --sort=-v:refname`.text()).trim().split('\n')[0];
  if (lastTag) {
    const log = (await $`git log --oneline --no-decorate ${lastTag}..HEAD`.text()).trim();
    if (log) {
      console.log(`\n  Commits since ${lastTag}:`);
      for (const line of log.split('\n')) console.log(`    ${line}`);
    } else {
      console.log(`\n  No new commits since ${lastTag}`);
    }
  }

  const summary = [
    `  ${isDryRun ? YLW + 'Would:' : GRN + 'Executing:'}${RST}`,
    `    git tag -a ${tag} -m "Release ${tag}"`,
    `    git push origin ${tag}`,
    `    gh release create ${tag} --title "${tag}" --notes-from-tag`,
  ];
  console.log('');
  for (const line of summary) console.log(line);

  if (!isDryRun) {
    try {
      await $`git tag -a ${tag} -m ${`Release ${tag}`}`;
      console.log(`${GRN}  ✓ Tag created${RST}`);
    } catch (err: any) {
      console.error(`${RED}  ✖ Failed to create tag: ${err.stderr || err.message}${RST}`);
      process.exit(1);
    }

    try {
      await $`git push origin ${tag}`;
      console.log(`${GRN}  ✓ Tag pushed${RST}`);
    } catch (err: any) {
      console.error(`${RED}  ✖ Failed to push tag: ${err.stderr || err.message}${RST}`);
      process.exit(1);
    }

    try {
      await $`gh release create ${tag} --title ${tag} --notes-from-tag`;
      console.log(`${GRN}  ✓ Release created${RST}`);
      console.log(`${GRN}\n  https://github.com/nathwn12/agnes/releases/tag/${tag}${RST}`);
    } catch (err: any) {
      console.error(`${RED}  ✖ Failed to create release: ${err.stderr || err.message}${RST}`);
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error(`${RED}  ✖ ${err.message}${RST}`);
  process.exit(1);
});
