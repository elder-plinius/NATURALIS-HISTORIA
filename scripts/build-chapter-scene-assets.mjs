import { createHash } from 'node:crypto';
import { access, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const provenancePath = path.join(root, 'assets-source', 'chapter-scenes-provenance.json');
const rightsPath = path.join(root, 'assets-source', 'asset-rights.json');
const publicAssetsRoot = path.join(root, 'public', 'assets');
const outputModulePath = path.join(root, 'app', 'generated-chapter-scene-sources.mjs');
const PIPELINE_REVISION = `chapter-scenes-v1:sharp-${sharp.versions.sharp}:avif58-444:webp84:mozjpeg82`;

async function readOptionalJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function renderDerivative(sourcePath, outputPath, width, format) {
  if (await exists(outputPath)) return;
  const pipeline = sharp(sourcePath).resize({ width, withoutEnlargement: true });
  if (format === 'avif') await pipeline.avif({ quality: 58, effort: 6, chromaSubsampling: '4:4:4' }).toFile(outputPath);
  else if (format === 'webp') await pipeline.webp({ quality: 84, effort: 6, smartSubsample: true }).toFile(outputPath);
  else await pipeline.jpeg({ quality: 82, mozjpeg: true }).toFile(outputPath);
}

const provenance = await readOptionalJson(provenancePath, {
  schemaVersion: 1,
  campaign: 'naturalis-chapter-scenes-v1',
  generatedAt: '2026-08-24',
  tool: 'OpenAI built-in image_gen',
  creator: 'OpenAI ImageGen, directed by the project owner and Codex',
  records: {},
});
const mediaRights = JSON.parse(await readFile(rightsPath, 'utf8'));
if (provenance.schemaVersion !== 1 || !provenance.records || mediaRights.schemaVersion !== 1) {
  throw new Error('Chapter-scene provenance or media-rights schema is invalid.');
}

const chapterSources = {};
const publicProvenanceRecords = [];
const sourceHashes = new Set();
const receiptIds = new Set();
const expectedOutputs = new Set();

for (const [chapterKey, record] of Object.entries(provenance.records).sort(([left], [right]) => left.localeCompare(right, 'en', { numeric: true }))) {
  if (record.chapterKey !== chapterKey || !/^\d+:(?:praef|\d+)$/.test(chapterKey)) {
    throw new Error(`Invalid chapter-scene key ${chapterKey}.`);
  }
  const evidenceId = record.receiptId ?? record.generationArtifactId;
  if (!record.sourceArtifact || !record.prompt || record.builtInMode !== true || !evidenceId) {
    throw new Error(`${chapterKey} lacks a source artifact, exact prompt, built-in mode record, or generation evidence ID.`);
  }
  if (receiptIds.has(evidenceId)) throw new Error(`Chapter scenes reuse generation evidence ${evidenceId}.`);
  receiptIds.add(evidenceId);
  if (record.visualQa?.status !== 'passed') throw new Error(`${chapterKey} has not passed visual QA.`);

  const sourcePath = path.join(root, record.sourceArtifact);
  const sourceBytes = await readFile(sourcePath);
  const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
  if (sourceHashes.has(sourceSha256)) throw new Error(`${chapterKey} duplicates another chapter-scene source hash.`);
  sourceHashes.add(sourceSha256);
  if (record.sourceSha256 && record.sourceSha256 !== sourceSha256) {
    throw new Error(`${chapterKey} source hash drifted from its generation receipt.`);
  }

  const metadata = await sharp(sourceBytes).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Could not read ${record.sourceArtifact}.`);
  const aspectRatio = metadata.width / metadata.height;
  if (metadata.width < 1200 || metadata.height < 800 || aspectRatio < 4 / 3 || aspectRatio > 16 / 9 || metadata.hasAlpha) {
    throw new Error(`${chapterKey} must be an opaque release master of at least 1200x800 between 4:3 and 16:9.`);
  }

  const rightsId = `chapter-scene:${chapterKey}`;
  const rights = mediaRights.assets?.[rightsId];
  if (!rights || rights.sourceArtifact !== record.sourceArtifact || rights.sourceSha256 !== sourceSha256
    || rights.rightsStatus?.includes('pending') || !rights.rightsHolder || !rights.license || !rights.evidence) {
    throw new Error(`${chapterKey} lacks a cleared, source-hash-bound rights record.`);
  }

  const [bookNumber, chapterId] = chapterKey.split(':');
  const sceneStem = `chapter-b${bookNumber.padStart(2, '0')}-${chapterId === 'praef' ? 'praef' : `c${chapterId.padStart(3, '0')}`}`;
  const mobileWidth = Math.min(1024, metadata.width);
  const nativeWidth = metadata.width;
  const hash = createHash('sha256').update(`${sourceSha256}:${PIPELINE_REVISION}`).digest('hex').slice(0, 8);
  const variants = {};
  for (const [label, width] of [['mobile', mobileWidth], ['native', nativeWidth]]) {
    variants[label] = {};
    for (const format of label === 'native' ? ['avif'] : ['avif', 'webp', 'jpeg']) {
      const extension = format === 'jpeg' ? 'jpg' : format;
      const outputName = `${sceneStem}.${hash}.w${width}.${extension}`;
      const outputPath = path.join(publicAssetsRoot, outputName);
      expectedOutputs.add(outputName);
      await renderDerivative(sourcePath, outputPath, width, format);
      variants[label][format] = `/assets/${outputName}`;
    }
  }

  const logicalPath = `/chapter-scenes/${sceneStem}.png`;
  const derivatives = [variants.mobile.avif, variants.mobile.webp, variants.mobile.jpeg, variants.native.avif];
  chapterSources[chapterKey] = {
    logicalPath,
    sourceArtifact: record.sourceArtifact,
    sourceSha256,
    width: metadata.width,
    height: metadata.height,
    description: record.title,
    pipelineRevision: PIPELINE_REVISION,
    desktop: {
      fallback: variants.mobile.jpeg,
      preload: variants.native.avif,
      imageSet: `image-set(url("${variants.native.avif}") type("image/avif") 1x, url("${variants.mobile.webp}") type("image/webp") 1x)`,
    },
    mobile: {
      fallback: variants.mobile.jpeg,
      preload: variants.mobile.avif,
      imageSet: `image-set(url("${variants.mobile.avif}") type("image/avif") 1x, url("${variants.native.avif}") type("image/avif") 2x, url("${variants.mobile.webp}") type("image/webp") 1x)`,
    },
    derivatives,
  };
  publicProvenanceRecords.push({
    logicalId: rightsId,
    chapterKey,
    masterArtifact: record.sourceArtifact,
    sourceSha256,
    sourceDimensions: { width: metadata.width, height: metadata.height },
    role: 'one-to-one modern editorial chapter illustration',
    originStatus: `generated for this chapter on ${record.generatedAt ?? provenance.generatedAt}; exact prompt, receipt and visual QA recorded`,
    creator: provenance.creator,
    generationTool: provenance.tool,
    generationReceipt: {
      campaign: provenance.campaign,
      receiptId: record.receiptId ?? null,
      generationArtifactId: record.generationArtifactId ?? null,
      evidencePolicy: provenance.evidencePolicy ?? null,
      originalArtifact: record.originalArtifact ?? null,
      prompt: record.prompt,
      builtInMode: true,
      visualQa: record.visualQa,
    },
    pipelineRevision: PIPELINE_REVISION,
    derivatives,
    rightsStatus: rights.rightsStatus,
    rightsSourceSha256: rights.sourceSha256,
    rightsHolder: rights.rightsHolder,
    license: rights.license,
    rightsEvidence: rights.evidence,
    rightsProvenanceReference: rights.provenanceReference,
  });
}

for (const file of await readdir(publicAssetsRoot)) {
  if (expectedOutputs.has(file)) continue;
  if (/^chapter-b\d{2}-(?:praef|c\d+)\.[a-f0-9]{8}\.w\d+\.(?:avif|webp|jpg)$/.test(file)) {
    await unlink(path.join(publicAssetsRoot, file));
  }
}

const moduleText = `// Generated by scripts/build-chapter-scene-assets.mjs. Do not edit by hand.\n`
  + `export const CHAPTER_SCENE_SOURCES = Object.freeze(${JSON.stringify(chapterSources, null, 2)});\n\n`
  + `export function chapterSceneSourceFor(bookNumber, chapterId) {\n`
  + `  return CHAPTER_SCENE_SOURCES[\`${'${bookNumber}:${chapterId}'}\`] ?? null;\n`
  + `}\n`;
await writeFile(outputModulePath, moduleText);

const publicProvenancePath = path.join(root, 'public', 'provenance.json');
if (await exists(publicProvenancePath)) {
  const publicProvenance = JSON.parse(await readFile(publicProvenancePath, 'utf8'));
  publicProvenance.assets = [
    ...(publicProvenance.assets ?? []).filter((asset) => !String(asset.logicalId).startsWith('chapter-scene:')),
    ...publicProvenanceRecords,
  ];
  publicProvenance.edition.assetSetSha256 = createHash('sha256')
    .update(publicProvenance.assets.map((asset) => asset.sourceSha256).join('\n'))
    .digest('hex');
  await writeFile(publicProvenancePath, `${JSON.stringify(publicProvenance, null, 2)}\n`);
}

console.log(`Built ${Object.keys(chapterSources).length} certified one-to-one chapter-scene asset sets.`);
