import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  RELEASE_PROFILES,
  assertSafeRelativePath,
  hashFile,
  includeReleasePath,
} from './release-packaging.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'RELEASE-MANIFEST.sha256');
const manifestText = fs.readFileSync(manifestPath, 'utf8');
if (!manifestText.endsWith('\n')) throw new Error('Release manifest must end with a newline.');

const lines = manifestText.trim().split(/\r?\n/u);
const sortedLines = [...lines].sort((left, right) => left.localeCompare(right, 'en'));
if (lines.join('\n') !== sortedLines.join('\n')) throw new Error('Release manifest is not deterministically sorted.');

const declared = new Map();
for (const line of lines) {
  const match = line.match(/^([0-9a-f]{64})  (.+)$/u);
  if (!match) throw new Error(`Invalid release-manifest line: ${line}`);
  const relative = assertSafeRelativePath(match[2]);
  if (declared.has(relative)) throw new Error(`Duplicate release-manifest path: ${relative}`);
  declared.set(relative, match[1]);
}

const listed = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: root,
  encoding: 'utf8',
  shell: false,
});
if (listed.status !== 0) throw new Error(listed.stderr || 'Unable to enumerate release source through Git.');

const releasePaths = [...new Set(listed.stdout.split('\0').filter(Boolean))]
  .filter((relative) => includeReleasePath(relative, RELEASE_PROFILES.PUBLIC_REPO))
  .filter((relative) => fs.existsSync(path.join(root, relative)));
const expectedPaths = [...new Set([...releasePaths, 'RELEASE-PROFILE.json'])]
  .sort((left, right) => left.localeCompare(right, 'en'));

if (declared.size !== expectedPaths.length) {
  throw new Error(`Release manifest declares ${declared.size} paths; the public tree requires ${expectedPaths.length}.`);
}

for (const relative of expectedPaths) {
  const expected = declared.get(relative);
  if (!expected) throw new Error(`Public release path is absent from the manifest: ${relative}`);
  const absolute = path.join(root, relative);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Manifest path is not a regular file: ${relative}`);
  const actual = await hashFile(absolute);
  if (actual !== expected) throw new Error(`Release manifest digest mismatch: ${relative}`);
}

console.log(`Verified exact SHA-256 release manifest coverage for ${expectedPaths.length.toLocaleString('en-US')} public files.`);
