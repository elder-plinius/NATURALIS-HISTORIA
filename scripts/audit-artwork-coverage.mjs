import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readAuthenticatedReleaseProfile, resolveChapterSceneSourceMode } from './release-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/corpus/manifest.json'), 'utf8'));
const campaign = JSON.parse(fs.readFileSync(path.join(root, 'assets-source/plates-provenance.json'), 'utf8'));
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

const expectedCells = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'];
const receiptIds = new Set();
const sourceHashes = new Set();
const independentSceneIds = new Set();
const atlasArtworkIds = new Map();
for (const [file, record] of Object.entries(campaign.assets ?? {})) {
  if (!record.receiptId || receiptIds.has(record.receiptId)) throw new Error(`Missing or repeated generation receipt for ${file}`);
  receiptIds.add(record.receiptId);
  if (JSON.stringify(Object.keys(record.cells ?? {}).sort()) !== JSON.stringify(expectedCells)) {
    throw new Error(`${file} does not declare exactly six named independent cells`);
  }
  const sourceArtifact = path.join(root, 'assets-source', 'plates', file);
  const sourceSha256 = createHash('sha256').update(fs.readFileSync(sourceArtifact)).digest('hex');
  if (sourceHashes.has(sourceSha256)) throw new Error(`Receipt-backed source art is byte-identical: ${file}`);
  sourceHashes.add(sourceSha256);
  const logicalId = `plate:${path.basename(file, '.jpg')}`;
  const rightsRecord = rights.assets?.[logicalId];
  if (!rightsRecord || rightsRecord.rightsStatus.includes('pending') || rightsRecord.sourceSha256 !== sourceSha256) {
    throw new Error(`${file} is not source-hash-bound to a cleared rights record`);
  }
  expectedCells.forEach((cell) => {
    const sceneId = `${sourceSha256}#${cell}`;
    independentSceneIds.add(sceneId);
    atlasArtworkIds.set(`atlas-cell:${file}#${cell}`, sceneId);
  });
}

const chapterSceneArtworkIds = new Map();
const generationEvidenceIds = new Set();
for (const [chapterKey, record] of Object.entries(chapterScenes.records ?? {})) {
  const sourceArtifact = path.join(root, record.sourceArtifact ?? '');
  if (record.chapterKey !== chapterKey || !record.prompt || record.builtInMode !== true) {
    throw new Error(`Incomplete one-to-one chapter-scene receipt for ${chapterKey}`);
  }
  const evidenceId = record.receiptId ?? record.generationArtifactId;
  if (!evidenceId || generationEvidenceIds.has(evidenceId)) throw new Error(`Missing or repeated chapter-scene generation evidence for ${chapterKey}`);
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
  independentSceneIds.add(sourceSha256);
  chapterSceneArtworkIds.set(`chapter-scene:${chapterKey}`, sourceSha256);
}

const target = manifest.totalChapters;
const availableSourceArt = independentSceneIds.size;
const chapterArtworkManifestPath = path.join(root, 'assets-source', 'chapter-artwork-manifest.json');
let assignedChapterArtworks = 0;
let assignedAtlasCells = 0;
let assignedFullScenes = 0;
let availableUnusedAtlasCells = 0;
if (fs.existsSync(chapterArtworkManifestPath)) {
  const chapterArtworkManifest = JSON.parse(fs.readFileSync(chapterArtworkManifestPath, 'utf8'));
  if (chapterArtworkManifest.schemaVersion !== 1 || !chapterArtworkManifest.assignments) {
    throw new Error('Unsupported chapter-artwork manifest');
  }
  const assignments = Object.values(chapterArtworkManifest.assignments);
  const artworkIds = assignments.map((assignment) => assignment.artworkId);
  if (artworkIds.some((id) => !id) || new Set(artworkIds).size !== artworkIds.length) {
    throw new Error('Chapter-artwork assignments are missing IDs or reuse source art');
  }
  const validChapterKeys = new Set(manifest.books.flatMap((book) => {
    const bookData = JSON.parse(fs.readFileSync(path.join(root, 'public', book.file.replace(/^\//, '')), 'utf8'));
    return bookData.chapters.map((chapter) => `${book.number}:${chapter.id}`);
  }));
  const assignmentSceneIds = new Set();
  for (const [chapterKey, assignment] of Object.entries(chapterArtworkManifest.assignments)) {
    if (!validChapterKeys.has(chapterKey)) throw new Error(`Artwork manifest has unknown chapter ${chapterKey}`);
    const sceneId = assignment.kind === 'atlas-cell'
      ? atlasArtworkIds.get(assignment.artworkId)
      : assignment.kind === 'chapter-scene'
        ? chapterSceneArtworkIds.get(assignment.artworkId)
        : null;
    if (!sceneId || assignmentSceneIds.has(sceneId)) throw new Error(`Artwork assignment is unverified or reused at ${chapterKey}`);
    assignmentSceneIds.add(sceneId);
    if (assignment.kind === 'atlas-cell') assignedAtlasCells += 1;
    else if (assignment.kind === 'chapter-scene') assignedFullScenes += 1;
  }
  assignedChapterArtworks = assignments.length;
  availableUnusedAtlasCells = chapterArtworkManifest.atlasCellInventory?.unusedCount ?? 0;
  const declaredCounts = chapterArtworkManifest.counts ?? {};
  if (declaredCounts.receiptBackedAtlasCellsAvailable !== atlasArtworkIds.size
    || declaredCounts.receiptBackedAtlasCellsAssigned !== assignedAtlasCells
    || declaredCounts.receiptBackedAtlasCellsUnused !== availableUnusedAtlasCells
    || assignedAtlasCells + availableUnusedAtlasCells !== atlasArtworkIds.size
    || declaredCounts.generatedFullScenes !== assignedFullScenes
    || declaredCounts.certifiedOneToOneAssignments !== assignedChapterArtworks) {
    throw new Error('Certified artwork counts do not reconcile with the assignment and available-unused inventories');
  }
}

const additionalScenesNeeded = Math.max(0, target - assignedChapterArtworks);

console.log(
  `Independent source-art inventory: ${availableSourceArt} source-hash-bound scenes (${atlasArtworkIds.size} receipt-backed atlas cells + ${chapterSceneArtworkIds.size} one-to-one full scenes${chapterSceneSourceMode === 'prebuilt-public' ? ', chapter hashes verified through authenticated prebuilt provenance' : ', chapter hashes verified against preservation-master bytes'}). `
  + `Verified one-to-one chapter artwork assignments: ${assignedChapterArtworks}/${target} (${assignedFullScenes} full scenes + ${assignedAtlasCells} atlas cells; ${availableUnusedAtlasCells} atlas cells preserved available-unused). `
  + `${additionalScenesNeeded} additional independent scenes remain before the 1,065-original-illustrations claim is allowed.`,
);

if (availableSourceArt < target || assignedChapterArtworks !== target) process.exit(1);
