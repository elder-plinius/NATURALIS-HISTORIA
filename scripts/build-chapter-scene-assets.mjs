import { createHash } from 'node:crypto';
import { access, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import sharp from 'sharp';

import { readAuthenticatedReleaseProfile, resolveChapterSceneSourceMode } from './release-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const provenancePath = path.join(root, 'assets-source', 'chapter-scenes-provenance.json');
const rightsPath = path.join(root, 'assets-source', 'asset-rights.json');
const publicAssetsRoot = path.join(root, 'public', 'assets');
const runtimeModulePath = path.join(root, 'app', 'generated-chapter-scene-sources.mjs');
const auditModulePath = path.join(root, 'app', 'generated-chapter-scene-audit-sources.mjs');
const publicProvenancePath = path.join(root, 'public', 'provenance.json');
const PIPELINE_REVISION = `chapter-scenes-v1:sharp-${sharp.versions.sharp}:avif58-444:webp84:mozjpeg82`;
const SOURCE_WIDTH = 1536;
const SOURCE_HEIGHT = 1024;
const MOBILE_WIDTH = 1024;

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

async function sha256File(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

function hasExactDerivativeHashes(record, derivatives) {
  const derivativeSha256 = record?.derivativeSha256;
  return derivativeSha256
    && !Array.isArray(derivativeSha256)
    && JSON.stringify(Object.keys(derivativeSha256)) === JSON.stringify(derivatives)
    && Object.values(derivativeSha256).every((digest) => /^[0-9a-f]{64}$/u.test(digest));
}

async function renderDerivative(sourcePath, outputPath, width, format, expectedSha256 = null) {
  if (expectedSha256 && await exists(outputPath) && await sha256File(outputPath) === expectedSha256) {
    return expectedSha256;
  }

  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  await unlink(temporaryPath).catch((error) => {
    if (error?.code !== 'ENOENT') throw error;
  });
  try {
    const pipeline = sharp(sourcePath).resize({ width, withoutEnlargement: true });
    if (format === 'avif') await pipeline.avif({ quality: 58, effort: 6, chromaSubsampling: '4:4:4' }).toFile(temporaryPath);
    else if (format === 'webp') await pipeline.webp({ quality: 84, effort: 6, smartSubsample: true }).toFile(temporaryPath);
    else await pipeline.jpeg({ quality: 82, mozjpeg: true }).toFile(temporaryPath);

    const digest = await sha256File(temporaryPath);
    if (expectedSha256 && digest !== expectedSha256) {
      throw new Error(`Deterministic derivative output drifted for ${path.basename(outputPath)}.`);
    }
    await rename(temporaryPath, outputPath);
    return digest;
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

function sceneStemFor(chapterKey) {
  const [bookNumber, chapterId] = chapterKey.split(':');
  return `chapter-b${bookNumber.padStart(2, '0')}-${chapterId === 'praef' ? 'praef' : `c${chapterId.padStart(3, '0')}`}`;
}

function deliveryRecordFor(chapterKey, deliveryHash) {
  const sceneStem = sceneStemFor(chapterKey);
  const assetBase = `/assets/${sceneStem}.${deliveryHash}`;
  const mobileAvif = `${assetBase}.w${MOBILE_WIDTH}.avif`;
  const mobileWebp = `${assetBase}.w${MOBILE_WIDTH}.webp`;
  const mobileJpeg = `${assetBase}.w${MOBILE_WIDTH}.jpg`;
  const nativeAvif = `${assetBase}.w${SOURCE_WIDTH}.avif`;
  return {
    logicalPath: `/chapter-scenes/${sceneStem}.png`,
    desktop: {
      fallback: mobileJpeg,
      preload: nativeAvif,
      imageSet: `image-set(url("${nativeAvif}") type("image/avif") 1x, url("${mobileWebp}") type("image/webp") 1x)`,
    },
    mobile: {
      fallback: mobileJpeg,
      preload: mobileAvif,
      imageSet: `image-set(url("${mobileAvif}") type("image/avif") 1x, url("${nativeAvif}") type("image/avif") 2x, url("${mobileWebp}") type("image/webp") 1x)`,
    },
    derivatives: [mobileAvif, mobileWebp, mobileJpeg, nativeAvif],
  };
}

async function readAuditSources() {
  if (!await exists(auditModulePath)) {
    throw new Error('Authenticated public-repo build lacks the full chapter-scene audit registry.');
  }
  const generated = await import(`${pathToFileURL(auditModulePath).href}?build=${Date.now()}`);
  const records = generated.CHAPTER_SCENE_AUDIT_SOURCES;
  if (!records || typeof records !== 'object') {
    throw new Error('Authenticated public-repo build lacks the full chapter-scene audit registry.');
  }
  return records;
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

const releaseProfile = readAuthenticatedReleaseProfile(root);
const sourceMode = resolveChapterSceneSourceMode(root, provenance.records, releaseProfile);
const previousAuditSources = await exists(auditModulePath) ? await readAuditSources() : null;
const prebuiltAuditSources = sourceMode === 'prebuilt-public' ? previousAuditSources : null;
const existingPublicProvenance = await readOptionalJson(publicProvenancePath, null);
if (!existingPublicProvenance) throw new Error('Public provenance is required to build chapter-scene assets.');
const existingPublicChapterRecords = new Map(
  (existingPublicProvenance.assets ?? [])
    .filter((record) => String(record.logicalId).startsWith('chapter-scene:'))
    .map((record) => [record.chapterKey, record]),
);

const auditSources = {};
const deliveryHashes = {};
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

  const rightsId = `chapter-scene:${chapterKey}`;
  const rights = mediaRights.assets?.[rightsId];
  if (!rights || rights.sourceArtifact !== record.sourceArtifact
    || rights.rightsStatus?.includes('pending') || !rights.rightsHolder || !rights.license || !rights.evidence) {
    throw new Error(`${chapterKey} lacks a cleared, source-bound rights record.`);
  }

  let sourceSha256;
  let width;
  let height;
  let pipelineRevision;
  if (sourceMode === 'masters') {
    const sourcePath = path.join(root, record.sourceArtifact);
    const sourceBytes = await readFile(sourcePath);
    sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
    if (record.sourceSha256 && record.sourceSha256 !== sourceSha256) {
      throw new Error(`${chapterKey} source hash drifted from its generation receipt.`);
    }
    const metadata = await sharp(sourceBytes).metadata();
    width = metadata.width;
    height = metadata.height;
    if (width !== SOURCE_WIDTH || height !== SOURCE_HEIGHT || metadata.hasAlpha) {
      throw new Error(`${chapterKey} must be an opaque ${SOURCE_WIDTH}x${SOURCE_HEIGHT} release master.`);
    }
    pipelineRevision = PIPELINE_REVISION;
  } else {
    const auditSource = prebuiltAuditSources[chapterKey];
    const publicRecord = existingPublicChapterRecords.get(chapterKey);
    if (!auditSource || !publicRecord) throw new Error(`Prebuilt audit/public provenance is missing ${chapterKey}.`);
    sourceSha256 = auditSource.sourceSha256;
    width = auditSource.width;
    height = auditSource.height;
    pipelineRevision = auditSource.pipelineRevision;
    if (!/^[0-9a-f]{64}$/u.test(sourceSha256)
      || sourceSha256 !== record.sourceSha256
      || sourceSha256 !== publicRecord.sourceSha256
      || auditSource.sourceArtifact !== record.sourceArtifact
      || publicRecord.masterArtifact !== record.sourceArtifact
      || width !== SOURCE_WIDTH
      || height !== SOURCE_HEIGHT
      || publicRecord.sourceDimensions?.width !== width
      || publicRecord.sourceDimensions?.height !== height
      || !/^chapter-scenes-v1:sharp-[^:]+:avif58-444:webp84:mozjpeg82$/u.test(pipelineRevision)
      || publicRecord.pipelineRevision !== pipelineRevision) {
      throw new Error(`Authenticated prebuilt chapter-scene receipt drifted for ${chapterKey}.`);
    }
  }

  if (sourceHashes.has(sourceSha256)) throw new Error(`${chapterKey} duplicates another chapter-scene source hash.`);
  sourceHashes.add(sourceSha256);
  if (rights.sourceSha256 !== sourceSha256) throw new Error(`${chapterKey} rights hash drifted from its source receipt.`);

  const deliveryHash = createHash('sha256').update(`${sourceSha256}:${pipelineRevision}`).digest('hex').slice(0, 8);
  const delivery = deliveryRecordFor(chapterKey, deliveryHash);
  for (const derivative of delivery.derivatives) expectedOutputs.add(path.basename(derivative));
  let derivativeSha256;

  if (sourceMode === 'masters') {
    const sourcePath = path.join(root, record.sourceArtifact);
    const previousSource = previousAuditSources?.[chapterKey];
    const previousHashes = previousSource?.sourceSha256 === sourceSha256
      && previousSource.pipelineRevision === pipelineRevision
      && JSON.stringify(previousSource.derivatives) === JSON.stringify(delivery.derivatives)
      && hasExactDerivativeHashes(previousSource, delivery.derivatives)
      ? previousSource.derivativeSha256
      : null;
    derivativeSha256 = {};
    for (const [output, derivativeWidth, format] of [
      [delivery.derivatives[0], MOBILE_WIDTH, 'avif'],
      [delivery.derivatives[1], MOBILE_WIDTH, 'webp'],
      [delivery.derivatives[2], MOBILE_WIDTH, 'jpeg'],
      [delivery.derivatives[3], SOURCE_WIDTH, 'avif'],
    ]) {
      derivativeSha256[output] = await renderDerivative(
        sourcePath,
        path.join(root, 'public', output.replace(/^\//, '')),
        derivativeWidth,
        format,
        previousHashes?.[output] ?? null,
      );
    }
  } else {
    const auditSource = prebuiltAuditSources[chapterKey];
    const publicRecord = existingPublicChapterRecords.get(chapterKey);
    if (auditSource.logicalPath !== delivery.logicalPath
      || JSON.stringify(auditSource.desktop) !== JSON.stringify(delivery.desktop)
      || JSON.stringify(auditSource.mobile) !== JSON.stringify(delivery.mobile)
      || JSON.stringify(auditSource.derivatives) !== JSON.stringify(delivery.derivatives)
      || JSON.stringify(publicRecord.derivatives) !== JSON.stringify(delivery.derivatives)
      || !hasExactDerivativeHashes(auditSource, delivery.derivatives)
      || !hasExactDerivativeHashes(publicRecord, delivery.derivatives)
      || JSON.stringify(auditSource.derivativeSha256) !== JSON.stringify(publicRecord.derivativeSha256)) {
      throw new Error(`Prebuilt delivery ledger drifted for ${chapterKey}.`);
    }
    derivativeSha256 = {};
    for (const derivative of delivery.derivatives) {
      const derivativePath = path.join(root, 'public', derivative.replace(/^\//, ''));
      if (!await exists(derivativePath)) {
        throw new Error(`Prebuilt derivative is missing for ${chapterKey}: ${derivative}`);
      }
      const digest = await sha256File(derivativePath);
      if (digest !== auditSource.derivativeSha256[derivative]) {
        throw new Error(`Prebuilt derivative bytes drifted for ${chapterKey}: ${derivative}`);
      }
      derivativeSha256[derivative] = digest;
    }
  }

  deliveryHashes[chapterKey] = deliveryHash;
  auditSources[chapterKey] = {
    logicalPath: delivery.logicalPath,
    sourceArtifact: record.sourceArtifact,
    sourceSha256,
    width,
    height,
    description: record.title,
    pipelineRevision,
    desktop: delivery.desktop,
    mobile: delivery.mobile,
    derivatives: delivery.derivatives,
    derivativeSha256,
  };
  publicProvenanceRecords.push({
    logicalId: rightsId,
    chapterKey,
    masterArtifact: record.sourceArtifact,
    sourceSha256,
    sourceDimensions: { width, height },
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
    pipelineRevision,
    derivatives: delivery.derivatives,
    derivativeSha256,
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

const runtimeModuleText = `// Generated by scripts/build-chapter-scene-assets.mjs. Do not edit by hand.\n`
  + `export const CHAPTER_SCENE_DELIVERY_HASHES = Object.freeze(${JSON.stringify(deliveryHashes)});\n\n`
  + `function sceneStemFor(bookNumber, chapterId) {\n`
  + `  const book = String(bookNumber).padStart(2, '0');\n`
  + `  const chapter = String(chapterId);\n`
  + `  return \`chapter-b${'${book}'}-${'${chapter === \'praef\' ? \'praef\' : `c${chapter.padStart(3, \'0\')}`}'}\`;\n`
  + `}\n\n`
  + `export function chapterSceneSourceFor(bookNumber, chapterId) {\n`
  + `  const hash = CHAPTER_SCENE_DELIVERY_HASHES[\`${'${bookNumber}:${chapterId}'}\`];\n`
  + `  if (!hash) return null;\n`
  + `  const stem = sceneStemFor(bookNumber, chapterId);\n`
  + `  const base = \`/assets/${'${stem}'}.${'${hash}'}\`;\n`
  + `  const mobileAvif = \`${'${base}'}.w1024.avif\`;\n`
  + `  const mobileWebp = \`${'${base}'}.w1024.webp\`;\n`
  + `  const mobileJpeg = \`${'${base}'}.w1024.jpg\`;\n`
  + `  const nativeAvif = \`${'${base}'}.w1536.avif\`;\n`
  + `  return {\n`
  + `    logicalPath: \`/chapter-scenes/${'${stem}'}.png\`,\n`
  + `    desktop: {\n`
  + `      fallback: mobileJpeg,\n`
  + `      preload: nativeAvif,\n`
  + `      imageSet: \`image-set(url("${'${nativeAvif}'}") type("image/avif") 1x, url("${'${mobileWebp}'}") type("image/webp") 1x)\`,\n`
  + `    },\n`
  + `    mobile: {\n`
  + `      fallback: mobileJpeg,\n`
  + `      preload: mobileAvif,\n`
  + `      imageSet: \`image-set(url("${'${mobileAvif}'}") type("image/avif") 1x, url("${'${nativeAvif}'}") type("image/avif") 2x, url("${'${mobileWebp}'}") type("image/webp") 1x)\`,\n`
  + `    },\n`
  + `    derivatives: [mobileAvif, mobileWebp, mobileJpeg, nativeAvif],\n`
  + `  };\n`
  + `}\n`;
await writeFile(runtimeModulePath, runtimeModuleText);

const auditModuleText = `// Generated by scripts/build-chapter-scene-assets.mjs. Audit-only: do not import from client code.\n`
  + `export const CHAPTER_SCENE_AUDIT_SOURCES = Object.freeze(${JSON.stringify(auditSources, null, 2)});\n\n`
  + `export function chapterSceneAuditSourceFor(bookNumber, chapterId) {\n`
  + `  return CHAPTER_SCENE_AUDIT_SOURCES[\`${'${bookNumber}:${chapterId}'}\`] ?? null;\n`
  + `}\n`;
await writeFile(auditModulePath, auditModuleText);

existingPublicProvenance.assets = [
  ...(existingPublicProvenance.assets ?? []).filter((asset) => !String(asset.logicalId).startsWith('chapter-scene:')),
  ...publicProvenanceRecords,
];
existingPublicProvenance.edition.assetSetSha256 = createHash('sha256')
  .update(existingPublicProvenance.assets.map((asset) => asset.sourceSha256).join('\n'))
  .digest('hex');
existingPublicProvenance.edition.chapterDerivativeSetSha256 = createHash('sha256')
  .update(JSON.stringify(publicProvenanceRecords.flatMap((record) => (
    record.derivatives.map((derivative) => [record.chapterKey, derivative, record.derivativeSha256[derivative]])
  ))))
  .digest('hex');
await writeFile(publicProvenancePath, `${JSON.stringify(existingPublicProvenance, null, 2)}\n`);

console.log(
  `Built ${Object.keys(auditSources).length} certified one-to-one chapter-scene asset sets (${sourceMode}); authenticated ${Object.keys(auditSources).length * 4} derivative files by SHA-256, emitted a lean delivery registry, and retained the hashes in the server-only audit registry.`,
);
