import { createHash } from 'node:crypto';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import policy from '../edition-policy.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(root, 'assets-source', 'plates');
const outputRoot = path.join(root, 'public', 'assets');
const appRoot = path.join(root, 'app');
const PIPELINE_REVISION = `responsive-plates-v2:sharp-${sharp.versions.sharp}:avif55-444:webp82:mozjpeg80`;
const ACTIVE_PLATE_FILES = Object.freeze([
  'dedication-pliny-vespasian.jpg',
  'pliny-younger-vesuvius-letters-atlas.jpg',
]);
const generationCampaign = JSON.parse(await readFile(path.join(root, 'assets-source', 'plates-provenance.json'), 'utf8'));
const mediaRights = JSON.parse(await readFile(path.join(root, 'assets-source', 'asset-rights.json'), 'utf8'));
const ogGeneration = JSON.parse(await readFile(path.join(root, 'assets-source', 'og-provenance.json'), 'utf8'));
const plateReceipts = generationCampaign.legacyAssets ?? {};
const receiptFiles = [...Object.keys(generationCampaign.assets ?? {}), ...Object.keys(plateReceipts)].sort();
if (
  generationCampaign.schemaVersion !== 1
  || Object.keys(generationCampaign.assets ?? {}).length !== 0
  || JSON.stringify(receiptFiles) !== JSON.stringify([...ACTIVE_PLATE_FILES].sort())
) {
  throw new Error('Active-plate provenance must contain exactly the dedication and Vesuvius afterword receipts.');
}
if (mediaRights.schemaVersion !== 1 || !mediaRights.assets || ogGeneration.schemaVersion !== 1) {
  throw new Error('Per-asset media rights or social-card provenance is missing.');
}
await mkdir(outputRoot, { recursive: true });

const ogSourcePath = path.join(root, 'assets-source', 'og.png');
const ogSourceBytes = await readFile(ogSourcePath);
await sharp(ogSourcePath)
  .resize({ width: 1200, height: 630, fit: 'cover' })
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(path.join(root, 'public', 'og.jpg'));

const files = [...ACTIVE_PLATE_FILES];
const expectedMasterCount = Object.keys(mediaRights.assets).filter((logicalId) => logicalId.startsWith('plate:')).length;
const chapterSceneRightsCount = Object.keys(mediaRights.assets).filter((logicalId) => logicalId.startsWith('chapter-scene:')).length;
const expectedPlateRights = ACTIVE_PLATE_FILES.map((file) => `plate:${path.basename(file, '.jpg')}`).sort();
const actualPlateRights = Object.keys(mediaRights.assets).filter((logicalId) => logicalId.startsWith('plate:')).sort();
if (expectedMasterCount !== ACTIVE_PLATE_FILES.length || JSON.stringify(actualPlateRights) !== JSON.stringify(expectedPlateRights)) {
  throw new Error(`Expected rights for exactly ${ACTIVE_PLATE_FILES.length} active plate masters.`);
}
if (chapterSceneRightsCount !== 1065) {
  throw new Error(`Expected rights for all 1065 chapter scenes, found ${chapterSceneRightsCount}.`);
}
if (Object.keys(mediaRights.assets).length !== files.length + chapterSceneRightsCount + 1 || !mediaRights.assets['social:og']) {
  throw new Error('Every active plate, chapter scene, and the social card must have exactly one explicit rights record.');
}

function rightsFor(logicalId, sourceArtifact, sourceSha256) {
  const record = mediaRights.assets[logicalId];
  if (!record || record.sourceArtifact !== sourceArtifact || !record.rightsStatus) {
    throw new Error(`Missing explicit rights record for ${logicalId}.`);
  }
  if (!record.rightsStatus.includes('pending') && (!record.rightsHolder || !record.license || !record.evidence)) {
    throw new Error(`Cleared media ${logicalId} lacks rights holder, license, or evidence.`);
  }
  if (!record.rightsStatus.includes('pending') && record.sourceSha256 !== sourceSha256) {
    throw new Error(`Cleared media ${logicalId} is not bound to the active source hash.`);
  }
  return record;
}

const expectedOutputs = new Set();
const sources = {};
const provenanceAssets = [];

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
  if (format === 'avif') await pipeline.avif({ quality: 55, effort: 6, chromaSubsampling: '4:4:4' }).toFile(outputPath);
  else if (format === 'webp') await pipeline.webp({ quality: 82, effort: 6, smartSubsample: true }).toFile(outputPath);
  else await pipeline.jpeg({ quality: 80, mozjpeg: true }).toFile(outputPath);
}

async function renderCropDerivative(sourcePath, outputPath, crop, format) {
  if (await exists(outputPath)) return;
  const pipeline = sharp(sourcePath).extract(crop);
  if (format === 'avif') await pipeline.avif({ quality: 55, effort: 6, chromaSubsampling: '4:4:4' }).toFile(outputPath);
  else if (format === 'webp') await pipeline.webp({ quality: 82, effort: 6, smartSubsample: true }).toFile(outputPath);
  else await pipeline.jpeg({ quality: 80, mozjpeg: true }).toFile(outputPath);
}

for (const file of files) {
  const sourcePath = path.join(sourceRoot, file);
  const bytes = await readFile(sourcePath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const hash = createHash('sha256').update(`${sha256}:${PIPELINE_REVISION}`).digest('hex').slice(0, 8);
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Could not read ${file}.`);
  const aspectRatio = metadata.width / metadata.height;
  if (metadata.width < 1200 || metadata.height < 800 || aspectRatio < 4 / 3 || aspectRatio > 16 / 9 || metadata.hasAlpha) {
    throw new Error(`${file} must remain an opaque, release-resolution landscape master between 4:3 and 16:9.`);
  }
  const generationReceipt = plateReceipts[file];
  if (
    generationReceipt.logicalId !== `plate:${path.basename(file, '.jpg')}`
    || generationReceipt.sourceArtifact !== `assets-source/plates/${file}`
    || generationReceipt.sourceSha256 !== sha256
  ) {
    throw new Error(`${file} has a generation receipt that is not bound to the active source.`);
  }
  if (
    file === 'pliny-younger-vesuvius-letters-atlas.jpg'
    && (metadata.width !== 1536 || metadata.height !== 1024 || metadata.hasAlpha)
  ) {
    throw new Error(`${file} must remain an opaque 1536x1024 four-panel afterword master.`);
  }
  const stem = path.basename(file, '.jpg');
  const mobileWidth = Math.min(1024, metadata.width);
  const variants = {};
  for (const [label, width] of [['mobile', mobileWidth], ['native', metadata.width]]) {
    variants[label] = {};
    for (const format of label === 'native' ? ['avif'] : ['avif', 'webp', 'jpeg']) {
      const extension = format === 'jpeg' ? 'jpg' : format;
      const outputName = `${stem}.${hash}.w${width}.${extension}`;
      const outputPath = path.join(outputRoot, outputName);
      expectedOutputs.add(outputName);
      await renderDerivative(sourcePath, outputPath, width, format);
      variants[label][format] = `/assets/${outputName}`;
    }
  }
  const logicalPath = `/assets/${file}`;
  const logicalId = `plate:${stem}`;
  const masterArtifact = `assets-source/plates/${file}`;
  const rights = rightsFor(logicalId, masterArtifact, sha256);
  const desktopSet = `image-set(url("${variants.native.avif}") type("image/avif") 1x, url("${variants.mobile.webp}") type("image/webp") 1x)`;
  const mobileSet = `image-set(url("${variants.mobile.avif}") type("image/avif") 1x, url("${variants.native.avif}") type("image/avif") 2x, url("${variants.mobile.webp}") type("image/webp") 1x)`;
  sources[logicalPath] = {
    sourceSha256: sha256,
    width: metadata.width,
    height: metadata.height,
    pipelineRevision: PIPELINE_REVISION,
    desktop: { fallback: variants.mobile.jpeg, preload: variants.native.avif, imageSet: desktopSet },
    mobile: { fallback: variants.mobile.jpeg, preload: variants.mobile.avif, imageSet: mobileSet },
    derivatives: [variants.mobile.avif, variants.mobile.webp, variants.mobile.jpeg, variants.native.avif],
  };
  provenanceAssets.push({
    logicalId,
    masterArtifact,
    sourceSha256: sha256,
    sourceDimensions: { width: metadata.width, height: metadata.height },
    role: 'modern editorial illustration',
    originStatus: `generated for this edition on ${generationReceipt.generatedAt}; recovered prompt digest, original hash, source binding and receipt recorded`,
    creator: generationCampaign.creator,
    generationTool: generationCampaign.tool,
    generationReceipt: {
      campaign: 'naturalis-legacy-plate-reconciliation-v1',
      receiptId: generationReceipt.receiptId,
      originalArtifact: generationReceipt.originalArtifact,
      originalSha256: generationReceipt.originalSha256,
      promptRecord: generationReceipt.promptRecord,
      generationPromptSha256: generationReceipt.generationPromptSha256,
      sourceBinding: generationReceipt.sourceBinding,
      sourceEncoding: generationReceipt.sourceEncoding,
    },
    pipelineRevision: PIPELINE_REVISION,
    derivatives: sources[logicalPath].derivatives,
    rightsStatus: rights.rightsStatus,
    rightsSourceSha256: rights.sourceSha256 ?? null,
    rightsHolder: rights.rightsHolder,
    license: rights.license,
    rightsEvidence: rights.evidence,
    rightsProvenanceReference: rights.provenanceReference,
  });
}

const afterwordLogicalPath = '/assets/pliny-younger-vesuvius-letters-atlas.jpg';
const afterwordSourcePath = path.join(sourceRoot, path.basename(afterwordLogicalPath));
const afterwordSource = sources[afterwordLogicalPath];
const afterwordPanelCrops = {
  observer: { left: 0, top: 0, width: 768, height: 512 },
  fleet: { left: 768, top: 0, width: 768, height: 512 },
  appeal: { left: 0, top: 512, width: 768, height: 512 },
  ash: { left: 768, top: 512, width: 768, height: 512 },
};
const afterwordPanels = {};
for (const [panel, crop] of Object.entries(afterwordPanelCrops)) {
  const cropHash = createHash('sha256').update(`${afterwordSource.sourceSha256}:${panel}:${JSON.stringify(crop)}:${PIPELINE_REVISION}`).digest('hex').slice(0, 8);
  const variants = {};
  for (const format of ['avif', 'webp', 'jpeg']) {
    const extension = format === 'jpeg' ? 'jpg' : format;
    const outputName = `pliny-younger-vesuvius-${panel}.${cropHash}.w${crop.width}.${extension}`;
    expectedOutputs.add(outputName);
    await renderCropDerivative(afterwordSourcePath, path.join(outputRoot, outputName), crop, format);
    variants[format] = `/assets/${outputName}`;
  }
  afterwordPanels[panel] = {
    fallback: variants.jpeg,
    imageSet: `image-set(url("${variants.avif}") type("image/avif") 1x, url("${variants.webp}") type("image/webp") 1x)`,
    crop,
    derivatives: [variants.avif, variants.webp, variants.jpeg],
  };
}
const afterwordProvenance = provenanceAssets.find((asset) => asset.logicalId === 'plate:pliny-younger-vesuvius-letters-atlas');
if (!afterwordProvenance) throw new Error('Vesuvius afterword provenance record is missing.');
afterwordProvenance.editorialCrops = Object.fromEntries(Object.entries(afterwordPanels).map(([panel, record]) => [panel, {
  crop: record.crop,
  derivatives: record.derivatives,
}]));
if (
  Object.keys(sources).length !== 2
  || Object.keys(afterwordPanels).length !== 4
  || expectedOutputs.size !== 20
) {
  throw new Error('The active plate pipeline must emit 2 responsive plates, 4 Vesuvius crops, and no atlas-cell derivatives.');
}

const moduleText = `// Generated by scripts/build-responsive-assets.mjs. Do not edit by hand.\n`
  + `export const IMAGE_SOURCES = Object.freeze(${JSON.stringify(sources, null, 2)});\n`;
await writeFile(path.join(appRoot, 'generated-image-sources.mjs'), moduleText);

const cover = sources['/assets/dedication-pliny-vespasian.jpg'];
const afterword = sources['/assets/pliny-younger-vesuvius-letters-atlas.jpg'];
const cssText = `/* Generated by scripts/build-responsive-assets.mjs. */\n:root {\n`
  + `  --cover-image-fallback: url("${cover.desktop.fallback}");\n`
  + `  --cover-image-set-desktop: ${cover.desktop.imageSet};\n`
  + `  --cover-image-set-mobile: ${cover.mobile.imageSet};\n`
  + `  --afterword-image-fallback: url("${afterword.desktop.fallback}");\n`
  + `  --afterword-image-set-desktop: ${afterword.desktop.imageSet};\n`
  + `  --afterword-image-set-mobile: ${afterword.mobile.imageSet};\n`
  + Object.entries(afterwordPanels)
    .map(([panel, record]) => `  --afterword-panel-${panel}-fallback: url("${record.fallback}");\n  --afterword-panel-${panel}-image-set: ${record.imageSet};\n`)
    .join('')
  + `}\n`;
await writeFile(path.join(appRoot, 'generated-image-sources.css'), cssText);

const manifest = JSON.parse(await readFile(path.join(root, 'public', 'corpus', 'manifest.json'), 'utf8'));
const vesuviusLetters = JSON.parse(await readFile(path.join(root, 'app', 'afterword', 'vesuvius', 'letters-data.json'), 'utf8'));
const assetSetSha256 = createHash('sha256').update(provenanceAssets.map((asset) => asset.sourceSha256).join('\n')).digest('hex');
const ogSha256 = createHash('sha256').update(ogSourceBytes).digest('hex');
const ogRights = rightsFor('social:og', 'assets-source/og.png', ogSha256);
if (ogGeneration.logicalId !== 'social:og' || ogGeneration.sourceSha256 !== ogSha256) {
  throw new Error('Social-card generation receipt does not match the active source artifact.');
}
await writeFile(path.join(root, 'public', 'provenance.json'), `${JSON.stringify({
  schemaVersion: 1,
  edition: {
    id: policy.editionId,
    version: policy.version,
    releaseDate: policy.releaseDate,
    accessMode: policy.accessMode,
    publicIndexing: policy.publicIndexing,
    buildRevision: manifest.searchIndex?.revision ?? null,
    corpusManifest: '/corpus/manifest.json',
    editorialPolicy: '/edition',
    assetSetSha256,
    sourceMasters: {
      availability: 'omitted-from-public-repository',
      completeSourceAudit: 'required-before-public-extraction',
      publicProfileValidation: 'authenticated-derivative-sha256-and-provenance-only',
    },
  },
  artifacts: [{
    logicalId: 'social:og',
    sourceArtifact: 'assets-source/og.png',
    sourceSha256: ogSha256,
    outputArtifact: '/og.jpg',
    role: 'social preview image',
    originStatus: `generated for this edition on ${ogGeneration.generatedAt}; prompt and receipt recorded`,
    creator: ogGeneration.creator,
    generationTool: ogGeneration.generationTool,
    generationReceipt: ogGeneration.generationReceipt,
    rightsStatus: ogRights.rightsStatus,
    rightsSourceSha256: ogRights.sourceSha256,
    rightsHolder: ogRights.rightsHolder,
    license: ogRights.license,
    rightsEvidence: ogRights.evidence,
    rightsProvenanceReference: ogRights.provenanceReference,
  }],
  texts: [
    {
      id: 'perseus-mayhoff-lat2',
      role: 'latin-base-text',
      work: 'Naturalis Historia',
      author: 'Pliny the Elder',
      editionEditor: 'Karl Friedrich Theodor Mayhoff',
      citation: manifest.latinEdition,
      sourceUrl: manifest.sources.latin.url,
      sourceRelease: manifest.sources.latin.release,
      sourceCommit: manifest.sources.latin.commit,
      sha256: manifest.sources.latin.sha256,
      correctionLedger: manifest.corrections.file,
      correctionLedgerSha256: manifest.corrections.sha256,
      license: 'CC-BY-SA-4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      outputLicense: 'CC-BY-SA-4.0',
      modifications: ['critical apparatus omitted', 'reading text extracted', 'verified extraction repairs', 'aligned to historical translation'],
    },
    {
      id: 'bostock-riley-1855-57',
      role: 'facing-translation',
      work: 'The Natural History of Pliny',
      author: 'Pliny the Elder',
      translators: ['John Bostock', 'H. T. Riley'],
      citation: manifest.englishEdition,
      sourceManifest: '/corpus/manifest.json#/sources/english',
      sourceRecords: manifest.sources.english,
      correctionLedger: manifest.corrections.file,
      correctionLedgerSha256: manifest.corrections.sha256,
      rightsBasis: 'Public domain in the United States according to the Project Gutenberg source records; status may differ elsewhere',
    },
    {
      id: 'perseus-pliny-younger-letters-lat1',
      role: 'afterword-latin-source',
      work: vesuviusLetters.latinSource.work,
      author: 'Pliny the Younger',
      citation: 'Epistulae VI.16 and VI.20',
      sourceUrl: vesuviusLetters.latinSource.url,
      sourceCommit: vesuviusLetters.latinSource.commit,
      sha256: vesuviusLetters.latinSource.sha256,
      license: vesuviusLetters.latinSource.license,
      licenseUrl: vesuviusLetters.latinSource.licenseUrl,
      outputLicense: vesuviusLetters.latinSource.license,
      modifications: vesuviusLetters.latinSource.modifications,
    },
    {
      id: 'melmoth-bosanquet-pliny-younger-2811',
      role: 'afterword-facing-translation',
      work: vesuviusLetters.englishSource.work,
      author: 'Pliny the Younger',
      translator: vesuviusLetters.englishSource.translator,
      reviser: vesuviusLetters.englishSource.reviser,
      citation: vesuviusLetters.englishSource.source,
      sourceUrl: vesuviusLetters.englishSource.url,
      sha256: vesuviusLetters.englishSource.sha256,
      rightsBasis: vesuviusLetters.englishSource.rightsBasis,
      modifications: vesuviusLetters.englishSource.modifications,
    },
  ],
  assets: provenanceAssets,
}, null, 2)}\n`);

const outputBytes = (await Promise.all([...expectedOutputs].map((file) => stat(path.join(outputRoot, file))))).reduce((sum, value) => sum + value.size, 0);
console.log(`Built ${expectedOutputs.size} responsive plate derivatives from ${files.length} masters / ${(outputBytes / 1024 / 1024).toFixed(2)} MiB deployed`);
