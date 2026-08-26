import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalChapterSceneCount = 1_065;
const corpusManifest = JSON.parse(await readFile(path.join(root, 'public', 'corpus', 'manifest.json'), 'utf8'));
const provenance = JSON.parse(await readFile(path.join(root, 'assets-source', 'chapter-scenes-provenance.json'), 'utf8'));
const records = Object.entries(provenance.records ?? {});
if (corpusManifest.totalChapters !== canonicalChapterSceneCount) {
  throw new Error(`Canonical corpus size drifted: expected ${canonicalChapterSceneCount}, found ${corpusManifest.totalChapters}.`);
}
if (records.length !== canonicalChapterSceneCount) {
  throw new Error(`Expected ${canonicalChapterSceneCount} independent chapter-scene receipts; found ${records.length}.`);
}
const expectedChapterKeys = new Set((await Promise.all(corpusManifest.books.map(async (book) => {
  const bookData = JSON.parse(await readFile(path.join(root, 'public', book.file.replace(/^\//, '')), 'utf8'));
  return bookData.chapters.map((chapter) => `${book.number}:${chapter.id}`);
}))).flat());
if (expectedChapterKeys.size !== canonicalChapterSceneCount
  || records.some(([chapterKey]) => !expectedChapterKeys.has(chapterKey))) {
  throw new Error('Chapter-scene provenance does not exactly cover the 1,065 canonical corpus routes.');
}
const sourceHashes = new Set();
const evidenceIds = new Set();
const prompts = new Set();
const fingerprints = [];

for (const [chapterKey, record] of records) {
  const sourcePath = path.join(root, record.sourceArtifact);
  const bytes = await readFile(sourcePath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const evidenceId = record.receiptId ?? record.generationArtifactId;
  if (record.chapterKey !== chapterKey || sha256 !== record.sourceSha256) throw new Error(`${chapterKey} source identity drifted.`);
  if (!evidenceId || evidenceIds.has(evidenceId)) throw new Error(`${chapterKey} lacks unique built-in generation evidence.`);
  if (!record.prompt || prompts.has(record.prompt)) throw new Error(`${chapterKey} lacks a unique exact prompt.`);
  if (sourceHashes.has(sha256)) throw new Error(`${chapterKey} is byte-identical to another scene.`);
  if (record.visualQa?.status !== 'passed' || !record.visualQa.notes?.length) throw new Error(`${chapterKey} lacks visual QA evidence.`);
  evidenceIds.add(evidenceId);
  prompts.add(record.prompt);
  sourceHashes.add(sha256);

  const metadata = await sharp(bytes).metadata();
  if (metadata.width !== 1536 || metadata.height !== 1024 || metadata.hasAlpha || metadata.space !== 'srgb') {
    throw new Error(`${chapterKey} must remain a 1536x1024 opaque sRGB preservation master.`);
  }
  const { data } = await sharp(bytes)
    .resize(64, 64, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data: hashData } = await sharp(bytes)
    .resize(9, 8, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const differenceHash = [];
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      differenceHash.push(hashData[row * 9 + column] > hashData[row * 9 + column + 1]);
    }
  }
  fingerprints.push({ chapterKey, data, differenceHash });
}

let minimumMad = Number.POSITIVE_INFINITY;
let minimumHashDistance = Number.POSITIVE_INFINITY;
let closestMadPair = [];
let closestHashPair = [];
for (let left = 0; left < fingerprints.length; left += 1) {
  for (let right = left + 1; right < fingerprints.length; right += 1) {
    const leftFingerprint = fingerprints[left];
    const rightFingerprint = fingerprints[right];
    let totalDifference = 0;
    for (let index = 0; index < leftFingerprint.data.length; index += 1) {
      totalDifference += Math.abs(leftFingerprint.data[index] - rightFingerprint.data[index]);
    }
    const meanDifference = totalDifference / leftFingerprint.data.length;
    const hashDistance = leftFingerprint.differenceHash.reduce(
      (sum, bit, index) => sum + Number(bit !== rightFingerprint.differenceHash[index]),
      0,
    );
    if (meanDifference < minimumMad) {
      minimumMad = meanDifference;
      closestMadPair = [leftFingerprint.chapterKey, rightFingerprint.chapterKey];
    }
    if (hashDistance < minimumHashDistance) {
      minimumHashDistance = hashDistance;
      closestHashPair = [leftFingerprint.chapterKey, rightFingerprint.chapterKey];
    }
    if (meanDifference < 20 || hashDistance < 10) {
      throw new Error(`${leftFingerprint.chapterKey} and ${rightFingerprint.chapterKey} are perceptually too similar: MAD ${meanDifference.toFixed(2)}, dHash ${hashDistance}.`);
    }
  }
}

console.log(
  `Verified ${records.length} independent full chapter scenes: unique bytes, prompts and built-in output evidence; `
  + `1536x1024 opaque sRGB masters; minimum pairwise MAD ${Number.isFinite(minimumMad) ? minimumMad.toFixed(2) : 'n/a'} `
  + `(${closestMadPair.join(' / ') || 'single scene'}); minimum dHash ${Number.isFinite(minimumHashDistance) ? minimumHashDistance : 'n/a'} `
  + `(${closestHashPair.join(' / ') || 'single scene'}).`,
);
