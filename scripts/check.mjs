import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readAuthenticatedReleaseProfile, resolveChapterSceneSourceMode } from './release-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chapterScenes = JSON.parse(fs.readFileSync(path.join(root, 'assets-source', 'chapter-scenes-provenance.json'), 'utf8'));
const sourceMode = resolveChapterSceneSourceMode(root, chapterScenes.records, readAuthenticatedReleaseProfile(root));

const commands = [
  ['npm', ['run', 'typecheck']],
  ['npm', ['run', 'lint']],
  ['npm', ['run', 'test:corpus-assets']],
  ['npm', ['run', 'test:corpus']],
  ['npm', ['run', 'test:illustrations']],
  ['npm', ['run', 'test:chapter-scenes']],
  ['npm', ['run', 'test:provenance']],
  ['npm', ['run', 'test:share-pages']],
  ['npm', ['run', 'test:reader-effects']],
  ['npm', ['run', 'test:afterword']],
  ['npm', ['run', 'test:search']],
  ['npm', ['run', 'test:release-packaging']],
  ['npm', ['run', 'test:release-security']],
  ['npm', ['run', 'build']],
  ['npm', ['run', 'test:release-manifest']],
];

if (sourceMode === 'prebuilt-public') {
  const sourceOnlyIndex = commands.findIndex(([, args]) => args.includes('test:chapter-scenes'));
  if (sourceOnlyIndex === -1) throw new Error('Public-repo check could not identify the source-only chapter-scene test.');
  commands.splice(sourceOnlyIndex, 1);
  console.log('Authenticated public-repo profile: using generated-derivative provenance checks in place of the omitted master-byte/perceptual test.');
}

for (const [command, args] of commands) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`Verified ${commands.length} local build and edition gates`);
