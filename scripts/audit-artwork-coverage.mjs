import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readAuthenticatedReleaseProfile, resolveChapterSceneSourceMode } from './release-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/corpus/manifest.json'), 'utf8'));
const canonicalChapterSceneCount = 1_065;
const activePlateFiles = [
  'dedication-pliny-vespasian.jpg',
  'pliny-younger-vesuvius-letters-atlas.jpg',
];
const fail = (condition, message) => { if (!condition) throw new Error(message); };

fail(
  manifest.totalChapters === canonicalChapterSceneCount,
  `Canonical corpus size drifted: expected ${canonicalChapterSceneCount}, found ${manifest.totalChapters}`,
);

const plateCampaign = JSON.parse(fs.readFileSync(path.join(root, 'assets-source/plates-provenance.json'), 'utf8'));
const legacyPlateFiles = Object.keys(plateCampaign.legacyAssets ?? {}).sort();
fail(Object.keys(plateCampaign.assets ?? {}).length === 0, 'Retired atlas-cell campaign remains in the active provenance ledger');
fail(
  JSON.stringify(legacyPlateFiles) === JSON.stringify(activePlateFiles),
  `Expected exactly the two active non-chapter plates; found ${legacyPlateFiles.join(', ') || 'none'}`,
);

const rights = JSON.parse(fs.readFileSync(path.join(root, 'assets-source/asset-rights.json'), 'utf8'));
const chapterSceneProvenancePath = path.join(root, 'assets-source', 'chapter-scenes-provenance.json');
const chapterScenes = fs.existsSync(chapterSceneProvenancePath)
  ? JSON.parse(fs.readFileSync(chapterSceneProvenancePath, 'utf8'))
  : { schemaVersion: 1, records: {} };
const chapterSceneSourceMode = resolveChapterSceneSourceMode(
  root,
  chapterScenes.records,
  readAuthenticatedReleaseProfile(root),
);

const sourceHashes = new Set();
const chapterSceneArtworkIds = new Map();
const generationEvidenceIds = new Set();
for (const [chapterKey, record] of Object.entries(chapterScenes.records ?? {})) {
  const sourceArtifact = path.join(root, record.sourceArtifact ?? '');
  if (record.chapterKey !== chapterKey || !record.prompt || record.builtInMode !== true) {
    throw new Error(`Incomplete one-to-one chapter-scene receipt for ${chapterKey}`);
  }
  const evidenceId = record.receiptId ?? record.generationArtifactId;
  if (!evidenceId || generationEvidenceIds.has(evidenceId)) {
    throw new Error(`Missing or repeated chapter-scene generation evidence for ${chapterKey}`);
  }
  generationEvidenceIds.add(evidenceId);
  const sourceSha256 = chapterSceneSourceMode === 'masters'
    ? createHash('sha256').update(fs.readFileSync(sourceArtifact)).digest('hex')
    : record.sourceSha256;
  if (!/^[0-9a-f]{64}$/u.test(sourceSha256)) throw new Error(`Invalid chapter-scene source hash for ${chapterKey}`);
  if (record.sourceSha256 !== sourceSha256 || sourceHashes.has(sourceSha256)) {
    throw new Error(`Chapter-scene source hash drifted or repeats another source: ${chapterKey}`);
  }
  sourceHashes.add(sourceSha256);
  const rightsRecord = rights.assets?.[`chapter-scene:${chapterKey}`];
  if (!rightsRecord || rightsRecord.rightsStatus.includes('pending') || rightsRecord.sourceSha256 !== sourceSha256) {
    throw new Error(`Chapter scene ${chapterKey} is not source-hash-bound to a cleared rights record`);
  }
  chapterSceneArtworkIds.set(`chapter-scene:${chapterKey}`, sourceSha256);
}

fail(
  chapterSceneArtworkIds.size === canonicalChapterSceneCount,
  `Expected ${canonicalChapterSceneCount} independently generated chapter scenes; found ${chapterSceneArtworkIds.size}`,
);

const chapterArtworkManifestPath = path.join(root, 'assets-source/chapter-artwork-manifest.json');
fail(fs.existsSync(chapterArtworkManifestPath), 'Chapter-artwork manifest is missing');
const chapterArtworkManifest = JSON.parse(fs.readFileSync(chapterArtworkManifestPath, 'utf8'));
fail(chapterArtworkManifest.schemaVersion === 1 && chapterArtworkManifest.assignments, 'Unsupported chapter-artwork manifest');

const validChapterKeys = new Set(manifest.books.flatMap((book) => {
  const bookData = JSON.parse(fs.readFileSync(path.join(root, 'public', book.file.replace(/^\//, '')), 'utf8'));
  return bookData.chapters.map((chapter) => `${book.number}:${chapter.id}`);
}));
const assignmentEntries = Object.entries(chapterArtworkManifest.assignments);
const assignedSourceHashes = new Set();
for (const [chapterKey, assignment] of assignmentEntries) {
  fail(validChapterKeys.has(chapterKey), `Artwork manifest has unknown chapter ${chapterKey}`);
  fail(assignment.kind === 'chapter-scene', `Non-standalone chapter artwork remains assigned at ${chapterKey}`);
  const sourceHash = chapterSceneArtworkIds.get(assignment.artworkId);
  fail(sourceHash, `Artwork assignment is unverified at ${chapterKey}`);
  fail(!assignedSourceHashes.has(sourceHash), `Artwork source is reused at ${chapterKey}`);
  assignedSourceHashes.add(sourceHash);
}

const counts = chapterArtworkManifest.counts ?? {};
fail(assignmentEntries.length === canonicalChapterSceneCount, `Expected ${canonicalChapterSceneCount} chapter assignments; found ${assignmentEntries.length}`);
fail(assignedSourceHashes.size === canonicalChapterSceneCount, 'One-to-one chapter-source assignment count drifted');
fail(counts.chapters === canonicalChapterSceneCount, 'Certified chapter count drifted');
fail(counts.generatedFullScenes === canonicalChapterSceneCount, 'Generated full-scene count drifted');
fail(counts.certifiedOneToOneAssignments === canonicalChapterSceneCount, 'Certified assignment count drifted');
fail((counts.plannedFullScenes ?? 0) === 0, 'Planned chapter scenes remain unresolved');
fail((counts.receiptBackedAtlasCellsAvailable ?? 0) === 0, 'Atlas-cell inventory remains in the public artwork manifest');
fail((counts.receiptBackedAtlasCellsAssigned ?? 0) === 0, 'An atlas cell remains assigned to a chapter');
fail((counts.receiptBackedAtlasCellsUnused ?? 0) === 0, 'Retired atlas cells remain carried as unused production inventory');
fail(
  !chapterArtworkManifest.atlasCellInventory
    || ((chapterArtworkManifest.atlasCellInventory.availableCount ?? 0) === 0
      && (chapterArtworkManifest.atlasCellInventory.assignedCount ?? 0) === 0
      && (chapterArtworkManifest.atlasCellInventory.unusedCount ?? 0) === 0
      && (chapterArtworkManifest.atlasCellInventory.unusedCells?.length ?? 0) === 0),
  'Atlas-cell inventory contains active or supplementary entries',
);

console.log(
  `Verified ${canonicalChapterSceneCount.toLocaleString('en-US')} independently generated, source-hash-bound chapter scenes and ${assignmentEntries.length.toLocaleString('en-US')} one-to-one standalone assignments with zero atlas-cell inventory or routes${chapterSceneSourceMode === 'prebuilt-public' ? ' against authenticated prebuilt provenance' : ' against preservation-master bytes'}.`,
);
