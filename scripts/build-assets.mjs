import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readAuthenticatedReleaseProfile, resolveChapterSceneSourceMode } from './release-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const provenance = JSON.parse(fs.readFileSync(path.join(root, 'assets-source', 'chapter-scenes-provenance.json'), 'utf8'));
const profile = readAuthenticatedReleaseProfile(root);
const sourceMode = resolveChapterSceneSourceMode(root, provenance.records, profile);

const run = (script) => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], {
    cwd: root,
    shell: false,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

// Public releases carry reviewed derivatives and their historical encoder receipts.
// Re-encoding only the available supplementary masters on a Sharp upgrade would
// mix pipelines, leave orphan files, and mutate the release during deployment.
if (sourceMode === 'prebuilt-public') {
  run('verify-release-manifest.mjs');
  run('verify-provenance.mjs');
} else {
  run('build-responsive-assets.mjs');
}

run('build-chapter-scene-assets.mjs');

if (sourceMode === 'prebuilt-public') {
  run('verify-provenance.mjs');
  console.log('Regenerated the lean runtime/audit registries and verified preserved illustration derivatives from the authenticated public-repo profile.');
}
