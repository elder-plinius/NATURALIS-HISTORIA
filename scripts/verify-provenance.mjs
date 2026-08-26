import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { CELL_IMAGE_SOURCES, IMAGE_SOURCES } from '../app/generated-image-sources.mjs';
import { CHAPTER_SCENE_SOURCES } from '../app/generated-chapter-scene-sources.mjs';
import { PLATE_IMAGE_PATHS } from '../app/illustrations.mjs';
import policy from '../edition-policy.json' with { type: 'json' };
import { readAuthenticatedReleaseProfile, resolveChapterSceneSourceMode } from './release-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'public', 'corpus', 'manifest.json'), 'utf8'));
const provenance = JSON.parse(await readFile(path.join(root, 'public', 'provenance.json'), 'utf8'));
const generationCampaign = JSON.parse(await readFile(path.join(root, 'assets-source', 'plates-provenance.json'), 'utf8'));
const chapterSceneCampaign = JSON.parse(await readFile(path.join(root, 'assets-source', 'chapter-scenes-provenance.json'), 'utf8'));
const mediaRights = JSON.parse(await readFile(path.join(root, 'assets-source', 'asset-rights.json'), 'utf8'));
const ogGeneration = JSON.parse(await readFile(path.join(root, 'assets-source', 'og-provenance.json'), 'utf8'));
const generatedReceiptCount = Object.keys(generationCampaign.assets).length;
const chapterSceneCount = Object.keys(chapterSceneCampaign.records ?? {}).length;
const chapterSceneSourceMode = resolveChapterSceneSourceMode(
  root,
  chapterSceneCampaign.records,
  readAuthenticatedReleaseProfile(root),
);
const fail = (condition, message) => { if (!condition) throw new Error(message); };

fail(provenance.schemaVersion === 1, 'Unsupported provenance schema');
fail(provenance.edition.corpusManifest === '/corpus/manifest.json', 'Provenance points at the wrong corpus manifest');
fail(provenance.assets.length === PLATE_IMAGE_PATHS.length + chapterSceneCount, `Expected ${PLATE_IMAGE_PATHS.length + chapterSceneCount} asset records, found ${provenance.assets.length}`);
fail(provenance.edition.version === policy.version, 'Provenance edition version drifted');
fail(provenance.edition.publicIndexing === policy.publicIndexing, 'Provenance indexing policy drifted');
fail(new Set(provenance.assets.map((asset) => asset.logicalId)).size === PLATE_IMAGE_PATHS.length + chapterSceneCount, 'Provenance repeats an asset');
fail(Object.keys(mediaRights.assets ?? {}).length === PLATE_IMAGE_PATHS.length + chapterSceneCount + 1, 'Per-asset rights manifest is incomplete or contains inactive media');

for (const logicalPath of PLATE_IMAGE_PATHS) {
  const stem = path.basename(logicalPath, '.jpg');
  const record = provenance.assets.find((asset) => asset.logicalId === `plate:${stem}`);
  fail(record, `No provenance record for ${logicalPath}`);
  fail(record.masterArtifact === `assets-source/plates/${path.basename(logicalPath)}`, `Master artifact drifted for ${logicalPath}`);
  const master = await readFile(path.join(root, record.masterArtifact));
  fail(createHash('sha256').update(master).digest('hex') === record.sourceSha256, `Master hash drifted for ${logicalPath}`);
  const masterMetadata = await sharp(master).metadata();
  fail(record.sourceDimensions?.width === masterMetadata.width && record.sourceDimensions?.height === masterMetadata.height, `Master dimensions drifted for ${logicalPath}`);
  const responsive = IMAGE_SOURCES[logicalPath];
  fail(responsive?.sourceSha256 === record.sourceSha256, `Responsive source hash drifted for ${logicalPath}`);
  fail(responsive?.pipelineRevision === record.pipelineRevision, `Responsive pipeline receipt drifted for ${logicalPath}`);
  fail(JSON.stringify(responsive?.derivatives) === JSON.stringify(record.derivatives), `Derivative ledger drifted for ${logicalPath}`);
  const rights = mediaRights.assets[record.logicalId];
  fail(rights?.sourceArtifact === record.masterArtifact, `${logicalPath} has no explicit source-bound rights record`);
  fail(record.rightsStatus === rights.rightsStatus, `${logicalPath} rights status drifted from its per-asset record`);
  fail(record.rightsSourceSha256 === (rights.sourceSha256 ?? null), `${logicalPath} public rights hash drifted from its per-asset record`);
  fail(record.rightsHolder === rights.rightsHolder && record.license === rights.license && record.rightsEvidence === rights.evidence, `${logicalPath} rights evidence drifted`);
  if (!record.rightsStatus.includes('pending')) {
    fail(Boolean(record.rightsHolder && record.license && record.rightsEvidence), `${logicalPath} claims clearance without holder, license, and evidence`);
    fail(rights.sourceSha256 === record.sourceSha256, `${logicalPath} clearance is not bound to the active source hash`);
  }
  const generationReceipt = generationCampaign.assets[path.basename(logicalPath)] ?? null;
  if (generationReceipt) {
    fail(record.creator === generationCampaign.creator, `${logicalPath} lost its generated creator receipt`);
    fail(record.generationTool === generationCampaign.tool, `${logicalPath} lost its generation tool receipt`);
    fail(record.generationReceipt?.receiptId === generationReceipt.receiptId, `${logicalPath} has the wrong generation receipt`);
    fail(Object.keys(record.generationReceipt?.cells ?? {}).length === 6, `${logicalPath} lacks a six-cell subject ledger`);
    const expectedCells = Object.keys(generationReceipt.cells);
    fail(
      JSON.stringify(Object.keys(record.editorialCells ?? {})) === JSON.stringify(expectedCells)
        && JSON.stringify(Object.keys(CELL_IMAGE_SOURCES[logicalPath] ?? {})) === JSON.stringify(expectedCells),
      `${logicalPath} lacks its receipt-backed editorial cell ledger`,
    );
    for (const cell of expectedCells) {
      const cellRecord = record.editorialCells[cell];
      const cellSource = CELL_IMAGE_SOURCES[logicalPath][cell];
      fail(cellRecord.label === generationReceipt.cells[cell], `${logicalPath}#${cell} lost its receipt-backed subject label`);
      fail(cellSource.sourceSha256 === record.sourceSha256, `${logicalPath}#${cell} is not bound to its preservation master`);
      fail(JSON.stringify(cellRecord.sourceCell) === JSON.stringify(cellSource.sourceCell), `${logicalPath}#${cell} source-cell geometry drifted`);
      fail(JSON.stringify(cellRecord.crop) === JSON.stringify(cellSource.crop), `${logicalPath}#${cell} editorial crop geometry drifted`);
      fail(cellRecord.outputDimensions?.width === cellSource.width
        && cellRecord.outputDimensions?.height === cellSource.height, `${logicalPath}#${cell} output dimensions drifted`);
      fail(cellRecord.pipelineRevision === cellSource.pipelineRevision, `${logicalPath}#${cell} pipeline receipt drifted`);
      fail(JSON.stringify(cellRecord.derivatives) === JSON.stringify(cellSource.derivatives), `${logicalPath}#${cell} derivative ledger drifted`);
    }
  } else {
    fail(record.creator === null && record.generationTool === null, `${logicalPath} invents unresolved creation provenance`);
    fail(record.editorialCells === undefined, `${logicalPath} invents receipt-backed editorial cells`);
  }
  fail(record.derivatives.length === 4, `${logicalPath} has an incomplete derivative ledger`);
  for (const derivative of record.derivatives) {
    const derivativePath = path.join(root, 'public', derivative.replace(/^\//, ''));
    await readFile(derivativePath);
    const nameMatch = path.basename(derivative).match(/\.w(\d+)\.(avif|webp|jpg)$/);
    fail(nameMatch, `${logicalPath} has an invalid derivative name`);
    const derivativeMetadata = await sharp(derivativePath).metadata();
    const expectedWidth = Number.parseInt(nameMatch[1], 10);
    const expectedHeight = Math.round((masterMetadata.height * expectedWidth) / masterMetadata.width);
    const expectedMediaType = nameMatch[2] === 'jpg' ? 'image/jpeg' : `image/${nameMatch[2]}`;
    fail(
      derivativeMetadata.width === expectedWidth
        && derivativeMetadata.height === expectedHeight
        && derivativeMetadata.mediaType === expectedMediaType
        && !derivativeMetadata.hasAlpha,
      `${logicalPath} derivative geometry or format drifted: ${derivative}`,
    );
  }
}

for (const [chapterKey, generationRecord] of Object.entries(chapterSceneCampaign.records ?? {})) {
  const source = CHAPTER_SCENE_SOURCES[chapterKey];
  const record = provenance.assets.find((asset) => asset.logicalId === `chapter-scene:${chapterKey}`);
  fail(source && record, `No runtime/public provenance record for chapter scene ${chapterKey}`);
  fail(record.chapterKey === chapterKey && record.masterArtifact === generationRecord.sourceArtifact, `Chapter scene identity drifted for ${chapterKey}`);
  let masterSha256;
  let masterMetadata;
  if (chapterSceneSourceMode === 'masters') {
    const master = await readFile(path.join(root, record.masterArtifact));
    masterSha256 = createHash('sha256').update(master).digest('hex');
    masterMetadata = await sharp(master).metadata();
  } else {
    masterSha256 = generationRecord.sourceSha256;
    masterMetadata = record.sourceDimensions;
    fail(/^[0-9a-f]{64}$/u.test(masterSha256), `Chapter scene recorded source hash is invalid for ${chapterKey}`);
    fail(Number.isSafeInteger(masterMetadata?.width) && Number.isSafeInteger(masterMetadata?.height), `Chapter scene recorded dimensions are invalid for ${chapterKey}`);
  }
  fail(masterSha256 === generationRecord.sourceSha256 && masterSha256 === record.sourceSha256, `Chapter scene source hash drifted for ${chapterKey}`);
  fail(record.sourceDimensions?.width === masterMetadata.width && record.sourceDimensions?.height === masterMetadata.height, `Chapter scene dimensions drifted for ${chapterKey}`);
  fail(source.sourceSha256 === masterSha256 && source.pipelineRevision === record.pipelineRevision, `Chapter scene runtime receipt drifted for ${chapterKey}`);
  fail(JSON.stringify(source.derivatives) === JSON.stringify(record.derivatives), `Chapter scene derivative ledger drifted for ${chapterKey}`);
  fail(record.generationTool === chapterSceneCampaign.tool && record.creator === chapterSceneCampaign.creator, `Chapter scene creator/tool provenance drifted for ${chapterKey}`);
  fail(record.generationReceipt?.receiptId === (generationRecord.receiptId ?? null)
    && record.generationReceipt?.generationArtifactId === (generationRecord.generationArtifactId ?? null)
    && record.generationReceipt?.prompt === generationRecord.prompt
    && record.generationReceipt?.builtInMode === true
    && record.generationReceipt?.visualQa?.status === 'passed', `Chapter scene generation evidence drifted for ${chapterKey}`);
  const rights = mediaRights.assets[`chapter-scene:${chapterKey}`];
  fail(rights?.sourceArtifact === record.masterArtifact
    && rights.sourceSha256 === masterSha256
    && !rights.rightsStatus.includes('pending')
    && record.rightsStatus === rights.rightsStatus
    && record.rightsHolder === rights.rightsHolder
    && record.license === rights.license
    && record.rightsEvidence === rights.evidence, `Chapter scene rights evidence drifted for ${chapterKey}`);
  fail(record.derivatives.length === 4 && new Set(record.derivatives).size === 4, `Chapter scene derivative set is incomplete for ${chapterKey}`);
  const [bookNumber, chapterId] = chapterKey.split(':');
  const sceneStem = `chapter-b${bookNumber.padStart(2, '0')}-${chapterId === 'praef' ? 'praef' : `c${chapterId.padStart(3, '0')}`}`;
  const expectedNameHash = createHash('sha256').update(`${masterSha256}:${source.pipelineRevision}`).digest('hex').slice(0, 8);
  for (const derivative of record.derivatives) {
    const derivativePath = path.join(root, 'public', derivative.replace(/^\//, ''));
    const nameMatch = path.basename(derivative).match(new RegExp(`^${sceneStem}\\.${expectedNameHash}\\.w(\\d+)\\.(avif|webp|jpg)$`));
    fail(nameMatch, `Chapter scene derivative name is invalid for ${chapterKey}`);
    const derivativeMetadata = await sharp(derivativePath).metadata();
    const expectedWidth = Number.parseInt(nameMatch[1], 10);
    const expectedHeight = Math.round((masterMetadata.height * expectedWidth) / masterMetadata.width);
    const expectedMediaType = nameMatch[2] === 'jpg' ? 'image/jpeg' : `image/${nameMatch[2]}`;
    fail(derivativeMetadata.width === expectedWidth
      && derivativeMetadata.height === expectedHeight
      && derivativeMetadata.mediaType === expectedMediaType
      && !derivativeMetadata.hasAlpha, `Chapter scene derivative geometry drifted for ${chapterKey}: ${derivative}`);
  }
}
fail(generatedReceiptCount > 0, 'Generated plate campaign has no receipts');
fail(provenance.assets.filter((asset) => asset.generationReceipt).length === generatedReceiptCount + chapterSceneCount, 'Public provenance lost generated plate or chapter-scene evidence');
const ogRecord = provenance.artifacts?.find((artifact) => artifact.logicalId === 'social:og');
fail(ogRecord?.sourceArtifact === 'assets-source/og.png', 'Social preview source receipt is missing');
const ogSource = await readFile(path.join(root, 'assets-source', 'og.png'));
fail(createHash('sha256').update(ogSource).digest('hex') === ogRecord?.sourceSha256, 'Social preview hash drifted');
fail(ogRecord?.generationReceipt?.receiptId === ogGeneration.generationReceipt.receiptId, 'Social preview generation receipt drifted');
const ogRights = mediaRights.assets['social:og'];
fail(ogRights?.sourceArtifact === ogRecord?.sourceArtifact, 'Social preview lacks a source-bound rights record');
fail(ogRecord?.rightsStatus === ogRights.rightsStatus, 'Social preview rights status drifted');
fail(ogRecord?.rightsSourceSha256 === ogRights.sourceSha256, 'Social preview public rights hash drifted');
fail(ogRecord?.rightsHolder === ogRights.rightsHolder && ogRecord?.license === ogRights.license && ogRecord?.rightsEvidence === ogRights.evidence, 'Social preview rights evidence drifted');
if (!ogRecord?.rightsStatus.includes('pending')) {
  fail(Boolean(ogRecord?.rightsHolder && ogRecord?.license && ogRecord?.rightsEvidence), 'Social preview claims clearance without holder, license, and evidence');
  fail(ogRights.sourceSha256 === ogRecord.sourceSha256, 'Social preview clearance is not bound to the active source hash');
}

const afterwordRecord = provenance.assets.find((asset) => asset.logicalId === 'plate:pliny-younger-vesuvius-letters-atlas');
const expectedAfterwordCrops = {
  observer: { left: 0, top: 0, width: 768, height: 512 },
  fleet: { left: 768, top: 0, width: 768, height: 512 },
  appeal: { left: 0, top: 512, width: 768, height: 512 },
  ash: { left: 768, top: 512, width: 768, height: 512 },
};
fail(
  JSON.stringify(Object.keys(afterwordRecord?.editorialCrops ?? {}).sort()) === JSON.stringify(Object.keys(expectedAfterwordCrops).sort()),
  'Vesuvius afterword crop ledger is incomplete',
);
for (const [panel, expectedCrop] of Object.entries(expectedAfterwordCrops)) {
  const cropRecord = afterwordRecord.editorialCrops[panel];
  fail(JSON.stringify(cropRecord.crop) === JSON.stringify(expectedCrop), `Vesuvius ${panel} crop geometry drifted`);
  fail(cropRecord.derivatives.length === 3 && new Set(cropRecord.derivatives).size === 3, `Vesuvius ${panel} derivative ledger is incomplete`);
  for (const derivative of cropRecord.derivatives) {
    const derivativePath = path.join(root, 'public', derivative.replace(/^\//, ''));
    const metadata = await sharp(derivativePath).metadata();
    const extension = path.extname(derivative).slice(1);
    const expectedMediaType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
    fail(metadata.width === expectedCrop.width
      && metadata.height === expectedCrop.height
      && metadata.mediaType === expectedMediaType
      && !metadata.hasAlpha, `Vesuvius ${panel} derivative geometry or format drifted: ${derivative}`);
  }
}
const declaredDerivativePaths = new Set([
  ...provenance.assets.flatMap((asset) => asset.derivatives),
  ...Object.values(afterwordRecord.editorialCrops).flatMap((crop) => crop.derivatives),
  ...provenance.assets.flatMap((asset) => Object.values(asset.editorialCells ?? {}).flatMap((cell) => cell.derivatives)),
]);
const deployedDerivativePaths = new Set(
  (await readdir(path.join(root, 'public', 'assets'))).map((file) => `/assets/${file}`),
);
fail(
  declaredDerivativePaths.size === deployedDerivativePaths.size
    && [...declaredDerivativePaths].every((derivative) => deployedDerivativePaths.has(derivative)),
  'Deployed responsive assets do not exactly match the public provenance ledger',
);

const latinRecord = provenance.texts.find((text) => text.id === 'perseus-mayhoff-lat2');
fail(latinRecord?.sha256 === manifest.sources.latin.sha256, 'Latin provenance hash disagrees with the corpus manifest');
fail(latinRecord?.sourceCommit === manifest.sources.latin.commit, 'Latin provenance commit is not immutable');
fail(latinRecord?.sourceRelease === manifest.sources.latin.release, 'Latin provenance release is missing');
fail(latinRecord?.correctionLedgerSha256 === manifest.corrections.sha256, 'Latin correction ledger receipt is stale');
fail(latinRecord?.license === 'CC-BY-SA-4.0', 'Latin output license is missing');
fail(latinRecord?.licenseUrl === 'https://creativecommons.org/licenses/by-sa/4.0/', 'Latin license URL is missing');
const englishRecord = provenance.texts.find((text) => text.id === 'bostock-riley-1855-57');
fail(englishRecord, 'English provenance record is missing');
fail(englishRecord?.correctionLedgerSha256 === manifest.corrections.sha256, 'English correction ledger receipt is stale');
const youngerLatin = provenance.texts.find((text) => text.id === 'perseus-pliny-younger-letters-lat1');
fail(youngerLatin?.sha256 === '313c67a08efae2c33d95cdb52004be5a0b6b5c2d8a58ecfd08dffdfc1465f257', 'Younger Latin afterword receipt is missing');
const youngerEnglish = provenance.texts.find((text) => text.id === 'melmoth-bosanquet-pliny-younger-2811');
fail(youngerEnglish?.sha256 === '38246747bde7ef4da17603bee74b5344cc1502f8e41d6515fe72651ca0e8fa9a', 'Younger English afterword receipt is missing');

const mediaRecords = [...provenance.artifacts, ...provenance.assets];
const pendingMedia = mediaRecords.filter((record) => record.rightsStatus.includes('pending')).length;
console.log(`Verified ${provenance.assets.length} source-bound illustration rights records, ${generatedReceiptCount} atlas receipts, ${chapterSceneCount} one-to-one chapter-scene evidence records${chapterSceneSourceMode === 'prebuilt-public' ? ' against authenticated prebuilt derivatives' : ' against preservation-master bytes'}, social preview generation provenance, ${mediaRecords.length - pendingMedia} cleared / ${pendingMedia} pending media records, and Elder/Younger text-source provenance`);
