import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readAuthenticatedReleaseProfile, resolveChapterSceneSourceMode } from './release-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const provenance = JSON.parse(fs.readFileSync(path.join(root, 'assets-source', 'chapter-scenes-provenance.json'), 'utf8'));
const profile = readAuthenticatedReleaseProfile(root);
const sourceMode = resolveChapterSceneSourceMode(root, provenance.records, profile);
const publicProvenancePath = path.join(root, 'public', 'provenance.json');
let prebuiltChapterRecords = [];
if (sourceMode === 'prebuilt-public') {
  const existingPublicProvenance = JSON.parse(fs.readFileSync(publicProvenancePath, 'utf8'));
  prebuiltChapterRecords = (existingPublicProvenance.assets ?? [])
    .filter((record) => String(record.logicalId).startsWith('chapter-scene:'));
  if (prebuiltChapterRecords.length !== Object.keys(provenance.records ?? {}).length) {
    throw new Error(`Prebuilt public provenance has ${prebuiltChapterRecords.length} chapter scenes; expected ${Object.keys(provenance.records ?? {}).length}.`);
  }
}

const run = (script) => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], {
    cwd: root,
    shell: false,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run('build-responsive-assets.mjs');
if (sourceMode === 'masters') {
  run('build-chapter-scene-assets.mjs');
} else {
  const rebuiltPublicProvenance = JSON.parse(fs.readFileSync(publicProvenancePath, 'utf8'));
  rebuiltPublicProvenance.assets = [...(rebuiltPublicProvenance.assets ?? []), ...prebuiltChapterRecords];
  rebuiltPublicProvenance.edition.assetSetSha256 = crypto.createHash('sha256')
    .update(rebuiltPublicProvenance.assets.map((record) => record.sourceSha256).join('\n'))
    .digest('hex');
  fs.writeFileSync(publicProvenancePath, `${JSON.stringify(rebuiltPublicProvenance, null, 2)}\n`, 'utf8');
  run('verify-provenance.mjs');
  console.log('Retained and verified prebuilt chapter-scene derivatives from the authenticated public-repo profile.');
}
