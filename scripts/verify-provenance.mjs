import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { VESUVIUS_FOLIO_SOURCES } from '../app/afterword/vesuvius/generated-folio-sources.mjs';
import { IMAGE_SOURCES } from '../app/generated-image-sources.mjs';
import { CHAPTER_SCENE_AUDIT_SOURCES } from '../app/generated-chapter-scene-audit-sources.mjs';
import { CHAPTER_SCENE_DELIVERY_HASHES, chapterSceneSourceFor } from '../app/generated-chapter-scene-sources.mjs';
import { PLATE_IMAGE_PATHS } from '../app/illustrations.mjs';
import policy from '../edition-policy.json' with { type: 'json' };
import { readAuthenticatedReleaseProfile, resolveChapterSceneSourceMode } from './release-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'public', 'corpus', 'manifest.json'), 'utf8'));
const provenance = JSON.parse(await readFile(path.join(root, 'public', 'provenance.json'), 'utf8'));
const generationCampaign = JSON.parse(await readFile(path.join(root, 'assets-source', 'plates-provenance.json'), 'utf8'));
const vesuviusFolioCampaign = JSON.parse(await readFile(path.join(root, 'assets-source', 'vesuvius-folios-provenance.json'), 'utf8'));
const chapterSceneCampaign = JSON.parse(await readFile(path.join(root, 'assets-source', 'chapter-scenes-provenance.json'), 'utf8'));
const mediaRights = JSON.parse(await readFile(path.join(root, 'assets-source', 'asset-rights.json'), 'utf8'));
const ogGeneration = JSON.parse(await readFile(path.join(root, 'assets-source', 'og-provenance.json'), 'utf8'));
const canonicalChapterSceneCount = 1_065;
const activePlatePaths = [
  '/assets/dedication-pliny-vespasian.jpg',
  '/assets/pliny-younger-vesuvius-letters-atlas.jpg',
];
const activePlateFiles = activePlatePaths.map((logicalPath) => path.basename(logicalPath));
const vesuviusFolioRecords = Object.entries(vesuviusFolioCampaign.records ?? {});
const vesuviusFolioPaths = vesuviusFolioRecords.map(([, record]) => record.logicalPath);
const responsivePlatePaths = [...activePlatePaths, ...vesuviusFolioPaths];
const generatedReceiptCount = Object.keys(generationCampaign.assets).length
  + Object.keys(generationCampaign.legacyAssets ?? {}).length
  + vesuviusFolioRecords.length;
const chapterSceneCount = Object.keys(chapterSceneCampaign.records ?? {}).length;
const chapterSceneSourceMode = resolveChapterSceneSourceMode(
  root,
  chapterSceneCampaign.records,
  readAuthenticatedReleaseProfile(root),
);
const fail = (condition, message) => { if (!condition) throw new Error(message); };

fail(manifest.totalChapters === canonicalChapterSceneCount, `Canonical corpus size drifted: expected ${canonicalChapterSceneCount}, found ${manifest.totalChapters}`);
fail(chapterSceneCount === canonicalChapterSceneCount, `Expected ${canonicalChapterSceneCount} chapter-scene receipts, found ${chapterSceneCount}`);
fail(Object.keys(CHAPTER_SCENE_AUDIT_SOURCES).length === canonicalChapterSceneCount, `Expected ${canonicalChapterSceneCount} full chapter-scene audit records`);
fail(Object.keys(CHAPTER_SCENE_DELIVERY_HASHES).length === canonicalChapterSceneCount, `Expected ${canonicalChapterSceneCount} lean chapter-scene delivery records`);
fail(Object.keys(generationCampaign.assets ?? {}).length === 0, 'Retired atlas-cell campaign remains in active plate provenance');
fail(
  JSON.stringify(Object.keys(generationCampaign.legacyAssets ?? {}).sort()) === JSON.stringify(activePlateFiles),
  'Active plate provenance must contain exactly the dedication and Vesuvius masters',
);
fail(vesuviusFolioRecords.length === 12, `Expected 12 Vesuvius folio receipts, found ${vesuviusFolioRecords.length}`);
fail(generatedReceiptCount === responsivePlatePaths.length, `Expected ${responsivePlatePaths.length} responsive plate receipts, found ${generatedReceiptCount}`);
fail(JSON.stringify([...PLATE_IMAGE_PATHS].sort()) === JSON.stringify(activePlatePaths), 'Illustration registry must contain exactly the two active non-chapter plates');
fail(JSON.stringify(Object.keys(VESUVIUS_FOLIO_SOURCES).sort()) === JSON.stringify(vesuviusFolioRecords.map(([, record]) => record.artworkId).sort()), 'Vesuvius folio source registry drifted');
fail(JSON.stringify(Object.keys(IMAGE_SOURCES).sort()) === JSON.stringify(responsivePlatePaths.sort()), 'Responsive plate source map contains inactive or missing plates');
fail(provenance.schemaVersion === 1, 'Unsupported provenance schema');
fail(provenance.edition.corpusManifest === '/corpus/manifest.json', 'Provenance points at the wrong corpus manifest');
fail(provenance.assets.length === responsivePlatePaths.length + chapterSceneCount, `Expected ${responsivePlatePaths.length + chapterSceneCount} asset records, found ${provenance.assets.length}`);
fail(provenance.edition.version === policy.version, 'Provenance edition version drifted');
fail(provenance.edition.publicIndexing === policy.publicIndexing, 'Provenance indexing policy drifted');
fail(
  JSON.stringify(provenance.edition.sourceMasters) === JSON.stringify({
    availability: 'omitted-from-public-repository',
    completeSourceAudit: 'required-before-public-extraction',
    publicProfileValidation: 'authenticated-derivative-sha256-and-provenance-only',
  }),
  'Provenance does not disclose the public-repository source-master boundary',
);
fail(new Set(provenance.assets.map((asset) => asset.logicalId)).size === responsivePlatePaths.length + chapterSceneCount, 'Provenance repeats an asset');
fail(Object.keys(mediaRights.assets ?? {}).length === responsivePlatePaths.length + chapterSceneCount + 1, 'Per-asset rights manifest is incomplete or contains inactive media');
fail(provenance.assets.every((asset) => asset.editorialCells === undefined), 'Public provenance still exposes an atlas-cell library');

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
  const legacyGenerationReceipt = generationCampaign.legacyAssets?.[path.basename(logicalPath)] ?? null;
  fail(legacyGenerationReceipt, `${logicalPath} has no active generation receipt`);
  fail(record.creator === generationCampaign.creator, `${logicalPath} lost its recovered creator receipt`);
  fail(record.generationTool === generationCampaign.tool, `${logicalPath} lost its recovered generation tool receipt`);
  fail(record.generationReceipt?.campaign === 'naturalis-legacy-plate-reconciliation-v1', `${logicalPath} has the wrong reconciliation campaign`);
  fail(record.generationReceipt?.receiptId === legacyGenerationReceipt.receiptId, `${logicalPath} has the wrong recovered generation receipt`);
  fail(record.generationReceipt?.originalArtifact === legacyGenerationReceipt.originalArtifact
    && record.generationReceipt?.originalSha256 === legacyGenerationReceipt.originalSha256
    && record.generationReceipt?.generationPromptSha256 === legacyGenerationReceipt.generationPromptSha256,
  `${logicalPath} lost its recovered original or prompt digest`);
  fail(record.sourceSha256 === legacyGenerationReceipt.sourceSha256
    && record.masterArtifact === legacyGenerationReceipt.sourceArtifact,
  `${logicalPath} recovered receipt is not bound to the active source`);
  fail(record.editorialCells === undefined, `${logicalPath} invents atlas-cell metadata`);
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

const vesuviusFolioHashes = new Set();
for (const [folioKey, generationRecord] of vesuviusFolioRecords) {
  const source = VESUVIUS_FOLIO_SOURCES[generationRecord.artworkId];
  const responsive = IMAGE_SOURCES[generationRecord.logicalPath];
  const record = provenance.assets.find((asset) => asset.logicalId === generationRecord.artworkId);
  fail(source && responsive && record, `No responsive/public provenance record for Vesuvius folio ${folioKey}`);
  fail(record.folioKey === folioKey && record.masterArtifact === generationRecord.sourceArtifact, `Vesuvius folio identity drifted for ${folioKey}`);
  const master = await readFile(path.join(root, record.masterArtifact));
  const masterSha256 = createHash('sha256').update(master).digest('hex');
  const masterMetadata = await sharp(master).metadata();
  fail(masterSha256 === generationRecord.sourceSha256 && masterSha256 === record.sourceSha256, `Vesuvius folio source hash drifted for ${folioKey}`);
  fail(!vesuviusFolioHashes.has(masterSha256), `Vesuvius folio source repeats another folio: ${folioKey}`);
  vesuviusFolioHashes.add(masterSha256);
  fail(masterMetadata.width === 1536 && masterMetadata.height === 1024 && masterMetadata.format === 'png' && !masterMetadata.hasAlpha, `Vesuvius folio master geometry drifted for ${folioKey}`);
  fail(record.sourceDimensions?.width === masterMetadata.width && record.sourceDimensions?.height === masterMetadata.height, `Vesuvius folio dimensions drifted for ${folioKey}`);
  fail(source.logicalPath === generationRecord.logicalPath && source.sourceSha256 === masterSha256, `Vesuvius folio runtime source drifted for ${folioKey}`);
  fail(responsive.sourceSha256 === masterSha256 && responsive.pipelineRevision === record.pipelineRevision, `Vesuvius responsive receipt drifted for ${folioKey}`);
  fail(JSON.stringify(source.derivatives) === JSON.stringify(responsive.derivatives)
    && JSON.stringify(source.derivatives) === JSON.stringify(record.derivatives), `Vesuvius derivative ledger drifted for ${folioKey}`);
  fail(record.role === 'one-to-one modern editorial afterword folio illustration', `Vesuvius folio role drifted for ${folioKey}`);
  fail(record.creator === vesuviusFolioCampaign.creator && record.generationTool === vesuviusFolioCampaign.tool, `Vesuvius creator/tool provenance drifted for ${folioKey}`);
  fail(record.generationReceipt?.campaign === vesuviusFolioCampaign.campaign
    && record.generationReceipt?.generationArtifactId === generationRecord.generationArtifactId
    && record.generationReceipt?.originalArtifact === generationRecord.originalArtifact
    && record.generationReceipt?.promptProfile === (generationRecord.promptProfile ?? null)
    && record.generationReceipt?.scenePrompt === (generationRecord.scenePrompt ?? null)
    && record.generationReceipt?.customPrompt === (generationRecord.customPrompt ?? null)
    && record.generationReceipt?.builtInMode === true
    && record.generationReceipt?.visualQa?.status === 'passed', `Vesuvius generation evidence drifted for ${folioKey}`);
  fail(generationRecord.customPrompt || (vesuviusFolioCampaign.promptProfiles[generationRecord.promptProfile] && generationRecord.scenePrompt), `Vesuvius exact prompt assembly is incomplete for ${folioKey}`);
  const rights = mediaRights.assets[generationRecord.artworkId];
  fail(rights?.sourceArtifact === record.masterArtifact
    && rights.sourceSha256 === masterSha256
    && !rights.rightsStatus.includes('pending')
    && record.rightsStatus === rights.rightsStatus
    && record.rightsHolder === rights.rightsHolder
    && record.license === rights.license
    && record.rightsEvidence === rights.evidence, `Vesuvius folio rights evidence drifted for ${folioKey}`);
  fail(record.derivatives.length === 4 && new Set(record.derivatives).size === 4, `Vesuvius derivative set is incomplete for ${folioKey}`);
  const expectedNameHash = createHash('sha256').update(`${masterSha256}:${source.pipelineRevision}`).digest('hex').slice(0, 8);
  for (const derivative of record.derivatives) {
    const derivativePath = path.join(root, 'public', derivative.replace(/^\//, ''));
    const nameMatch = path.basename(derivative).match(new RegExp(`^${path.parse(generationRecord.logicalPath).name}\\.${expectedNameHash}\\.w(\\d+)\\.(avif|webp|jpg)$`, 'u'));
    fail(nameMatch, `Vesuvius derivative name is invalid for ${folioKey}`);
    const derivativeMetadata = await sharp(derivativePath).metadata();
    const expectedWidth = Number.parseInt(nameMatch[1], 10);
    const expectedHeight = Math.round((masterMetadata.height * expectedWidth) / masterMetadata.width);
    const expectedMediaType = nameMatch[2] === 'jpg' ? 'image/jpeg' : `image/${nameMatch[2]}`;
    fail(derivativeMetadata.width === expectedWidth
      && derivativeMetadata.height === expectedHeight
      && derivativeMetadata.mediaType === expectedMediaType
      && !derivativeMetadata.hasAlpha, `Vesuvius derivative geometry drifted for ${folioKey}: ${derivative}`);
  }
}
fail(vesuviusFolioHashes.size === 12, 'Vesuvius folio source uniqueness drifted');

for (const [chapterKey, generationRecord] of Object.entries(chapterSceneCampaign.records ?? {})) {
  const source = CHAPTER_SCENE_AUDIT_SOURCES[chapterKey];
  const [bookNumber, chapterId] = chapterKey.split(':');
  const runtimeSource = chapterSceneSourceFor(bookNumber, chapterId);
  const record = provenance.assets.find((asset) => asset.logicalId === `chapter-scene:${chapterKey}`);
  fail(source && runtimeSource && record, `No audit/runtime/public provenance record for chapter scene ${chapterKey}`);
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
  fail(
    source.derivativeSha256
      && JSON.stringify(Object.keys(source.derivativeSha256)) === JSON.stringify(source.derivatives)
      && Object.values(source.derivativeSha256).every((digest) => /^[0-9a-f]{64}$/u.test(digest))
      && JSON.stringify(source.derivativeSha256) === JSON.stringify(record.derivativeSha256),
    `Chapter scene derivative SHA-256 ledger drifted for ${chapterKey}`,
  );
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
  const sceneStem = `chapter-b${bookNumber.padStart(2, '0')}-${chapterId === 'praef' ? 'praef' : `c${chapterId.padStart(3, '0')}`}`;
  const expectedNameHash = createHash('sha256').update(`${masterSha256}:${source.pipelineRevision}`).digest('hex').slice(0, 8);
  fail(CHAPTER_SCENE_DELIVERY_HASHES[chapterKey] === expectedNameHash, `Lean chapter-scene delivery hash drifted for ${chapterKey}`);
  fail(runtimeSource.logicalPath === source.logicalPath
    && JSON.stringify(runtimeSource.desktop) === JSON.stringify(source.desktop)
    && JSON.stringify(runtimeSource.mobile) === JSON.stringify(source.mobile)
    && JSON.stringify(runtimeSource.derivatives) === JSON.stringify(source.derivatives), `Lean chapter-scene delivery paths drifted for ${chapterKey}`);
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
const chapterDerivativeRecords = provenance.assets.filter((asset) => String(asset.logicalId).startsWith('chapter-scene:'));
const chapterDerivativeSetSha256 = createHash('sha256')
  .update(JSON.stringify(chapterDerivativeRecords.flatMap((record) => (
    record.derivatives.map((derivative) => [record.chapterKey, derivative, record.derivativeSha256[derivative]])
  ))))
  .digest('hex');
fail(
  provenance.edition.chapterDerivativeSetSha256 === chapterDerivativeSetSha256,
  'Chapter derivative-set digest drifted from the per-file provenance ledger',
);
fail(provenance.assets.filter((asset) => asset.generationReceipt).length === generatedReceiptCount + chapterSceneCount, 'Public provenance lost generated plate or chapter-scene evidence');
const ogRecord = provenance.artifacts?.find((artifact) => artifact.logicalId === 'social:og');
fail(provenance.artifacts?.length === 1, 'Public provenance must contain exactly one non-illustration artifact: the social card');
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
const ogOutput = await sharp(path.join(root, 'public', ogRecord.outputArtifact.replace(/^\//, ''))).metadata();
fail(
  ogOutput.width === 1200 && ogOutput.height === 630 && ogOutput.mediaType === 'image/jpeg' && !ogOutput.hasAlpha,
  'Social preview output geometry or format drifted',
);

const afterwordRecord = provenance.assets.find((asset) => asset.logicalId === 'plate:pliny-younger-vesuvius-letters-atlas');
const dedicationRecord = provenance.assets.find((asset) => asset.logicalId === 'plate:dedication-pliny-vespasian');
fail(dedicationRecord && dedicationRecord.editorialCrops === undefined, 'Dedication plate invents editorial crops');
fail(afterwordRecord && afterwordRecord.editorialCrops === undefined, 'The opening atlas must not retain repeated folio crop delivery');
const declaredDerivativePaths = new Set(provenance.assets.flatMap((asset) => asset.derivatives));
const deployedDerivativePaths = new Set(
  (await readdir(path.join(root, 'public', 'assets'))).map((file) => `/assets/${file}`),
);
fail(declaredDerivativePaths.size === canonicalChapterSceneCount * 4 + responsivePlatePaths.length * 4, `Expected 4,316 active illustration derivatives, found ${declaredDerivativePaths.size}`);
fail([...declaredDerivativePaths].every((derivative) => !/-cell-[a-z][0-9]\./u.test(derivative)), 'Atlas-cell derivative remains in the public provenance ledger');
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
console.log(`Verified ${chapterSceneCount} one-to-one chapter-scene records${chapterSceneSourceMode === 'prebuilt-public' ? ' against authenticated prebuilt derivatives' : ' against preservation-master bytes'}, 2 supplementary plate receipts, 12 one-to-one Vesuvius folio illustrations, 1 social card, 0 atlas-cell records or derivatives, ${mediaRecords.length - pendingMedia} cleared / ${pendingMedia} pending media records, and Elder/Younger text-source provenance`);
