import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { VESUVIUS_FOLIO_SOURCES } from '../app/afterword/vesuvius/generated-folio-sources.mjs';
import { IMAGE_SOURCES } from '../app/generated-image-sources.mjs';
import { CHAPTER_SCENE_AUDIT_SOURCES } from '../app/generated-chapter-scene-audit-sources.mjs';
import { CHAPTER_SCENE_DELIVERY_HASHES, chapterSceneSourceFor } from '../app/generated-chapter-scene-sources.mjs';
import { chapterIllustration, PLATE_IMAGE_PATHS } from '../app/illustrations.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const manifest = JSON.parse(fs.readFileSync(path.join(publicRoot, 'corpus', 'manifest.json'), 'utf8'));
const plateCampaign = JSON.parse(fs.readFileSync(path.join(root, 'assets-source', 'plates-provenance.json'), 'utf8'));
const vesuviusFolioCampaign = JSON.parse(fs.readFileSync(path.join(root, 'assets-source', 'vesuvius-folios-provenance.json'), 'utf8'));
const artworkManifest = JSON.parse(fs.readFileSync(path.join(root, 'assets-source', 'chapter-artwork-manifest.json'), 'utf8'));
const publicProvenance = JSON.parse(fs.readFileSync(path.join(publicRoot, 'provenance.json'), 'utf8'));
const canonicalChapterSceneCount = 1_065;
const activePlatePaths = [
  '/assets/dedication-pliny-vespasian.jpg',
  '/assets/pliny-younger-vesuvius-letters-atlas.jpg',
];
const activePlateFiles = activePlatePaths.map((logicalPath) => path.basename(logicalPath));
const vesuviusFolioRecords = Object.entries(vesuviusFolioCampaign.records ?? {});
const vesuviusFolioPaths = vesuviusFolioRecords.map(([, record]) => record.logicalPath);
const responsivePlatePaths = [...activePlatePaths, ...vesuviusFolioPaths];
const fail = (condition, message) => { if (!condition) throw new Error(message); };
const sha256File = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const forbiddenAuditImports = [];
const appDirectories = [path.join(root, 'app')];
while (appDirectories.length) {
  const directory = appDirectories.pop();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      appDirectories.push(absolute);
      continue;
    }
    if (!/\.(?:[cm]?js|tsx?)$/u.test(entry.name) || entry.name === 'generated-chapter-scene-audit-sources.mjs') continue;
    if (fs.readFileSync(absolute, 'utf8').includes('generated-chapter-scene-audit-sources')) {
      forbiddenAuditImports.push(path.relative(root, absolute));
    }
  }
}

fail(
  manifest.totalChapters === canonicalChapterSceneCount,
  `Canonical corpus size drifted: expected ${canonicalChapterSceneCount}, found ${manifest.totalChapters}`,
);
fail(Object.keys(plateCampaign.assets ?? {}).length === 0, 'Retired atlas-cell campaign remains in active plate provenance');
fail(
  JSON.stringify(Object.keys(plateCampaign.legacyAssets ?? {}).sort()) === JSON.stringify(activePlateFiles),
  'Active plate provenance must contain exactly the dedication and Vesuvius masters',
);
fail(JSON.stringify([...PLATE_IMAGE_PATHS].sort()) === JSON.stringify(activePlatePaths), 'Illustration registry contains an inactive non-chapter plate');
fail(vesuviusFolioRecords.length === 12, `Expected 12 Vesuvius folio masters, found ${vesuviusFolioRecords.length}`);
fail(JSON.stringify(Object.keys(VESUVIUS_FOLIO_SOURCES).sort()) === JSON.stringify(vesuviusFolioRecords.map(([, record]) => record.artworkId).sort()), 'Vesuvius folio source registry drifted');
fail(JSON.stringify(Object.keys(IMAGE_SOURCES).sort()) === JSON.stringify(responsivePlatePaths.sort()), 'Responsive plate source map contains an inactive or missing plate');
fail(Object.keys(CHAPTER_SCENE_AUDIT_SOURCES).length === canonicalChapterSceneCount, `Expected ${canonicalChapterSceneCount} chapter-scene audit records`);
fail(Object.keys(CHAPTER_SCENE_DELIVERY_HASHES).length === canonicalChapterSceneCount, `Expected ${canonicalChapterSceneCount} lean chapter-scene delivery records`);
fail(Object.values(CHAPTER_SCENE_DELIVERY_HASHES).every((hash) => /^[0-9a-f]{8}$/u.test(hash)), 'Lean chapter-scene registry contains non-hash metadata');
fail(forbiddenAuditImports.length === 0, `App code imports the audit-only chapter-scene registry: ${forbiddenAuditImports.join(', ')}`);
fail(
  !fs.readFileSync(path.join(root, 'app', 'generated-chapter-scene-sources.mjs'), 'utf8').includes('derivativeSha256'),
  'Per-file derivative hashes leaked into the lean client registry',
);

const assignments = Object.entries(artworkManifest.assignments ?? {});
fail(assignments.length === canonicalChapterSceneCount, `Expected ${canonicalChapterSceneCount} certified artwork assignments, found ${assignments.length}`);
fail(assignments.every(([, assignment]) => assignment.kind === 'chapter-scene'), 'A non-standalone chapter assignment remains');
const counts = artworkManifest.counts ?? {};
fail(counts.generatedFullScenes === canonicalChapterSceneCount, 'Generated full-scene count drifted');
fail(counts.certifiedOneToOneAssignments === canonicalChapterSceneCount, 'Certified assignment count drifted');
fail((counts.receiptBackedAtlasCellsAvailable ?? 0) === 0, 'Atlas-cell inventory remains available');
fail((counts.receiptBackedAtlasCellsAssigned ?? 0) === 0, 'An atlas cell remains assigned');
fail((counts.receiptBackedAtlasCellsUnused ?? 0) === 0, 'Retired atlas cells remain in production inventory');
fail(!artworkManifest.atlasCellInventory, 'Supplementary atlas-cell inventory remains in the public manifest');

const expectedMasterFiles = [...activePlateFiles].sort();
const activeMasterFiles = fs.readdirSync(path.join(root, 'assets-source', 'plates'))
  .filter((file) => /\.jpe?g$/iu.test(file))
  .sort();
fail(JSON.stringify(activeMasterFiles) === JSON.stringify(expectedMasterFiles), 'Active plate-master directory contains missing or retired files');

const declaredDerivativePaths = new Set();
const plateMasterHashes = new Set();
for (const logicalPath of activePlatePaths) {
  const source = IMAGE_SOURCES[logicalPath];
  const masterPath = path.join(root, 'assets-source', 'plates', path.basename(logicalPath));
  fail(fs.existsSync(masterPath), `Missing active plate master: ${logicalPath}`);
  fail(!fs.existsSync(path.join(publicRoot, logicalPath.replace(/^\//, ''))), `Plate master is deployed directly: ${logicalPath}`);
  const masterBytes = fs.readFileSync(masterPath);
  const masterSha256 = createHash('sha256').update(masterBytes).digest('hex');
  fail(!plateMasterHashes.has(masterSha256), `Byte-identical active plate master detected: ${logicalPath}`);
  plateMasterHashes.add(masterSha256);
  const metadata = await sharp(masterBytes).metadata();
  fail(metadata.width >= 1200 && metadata.height >= 800 && metadata.format === 'jpeg' && !metadata.hasAlpha, `Active plate master is below the geometry/format floor: ${logicalPath}`);
  fail(source.sourceSha256 === masterSha256, `Responsive source hash drifted: ${logicalPath}`);
  fail(source.width === metadata.width && source.height === metadata.height, `Responsive source geometry drifted: ${logicalPath}`);
  fail(source.derivatives.length === 4 && new Set(source.derivatives).size === 4, `Active plate derivative set is incomplete: ${logicalPath}`);
  const expectedNameHash = createHash('sha256').update(`${masterSha256}:${source.pipelineRevision}`).digest('hex').slice(0, 8);
  for (const derivative of source.derivatives) {
    fail(!declaredDerivativePaths.has(derivative), `Responsive derivative URL is reused: ${derivative}`);
    declaredDerivativePaths.add(derivative);
    const nameMatch = path.basename(derivative).match(new RegExp(`^[a-z0-9-]+\\.${expectedNameHash}\\.w(\\d+)\\.(avif|webp|jpg)$`, 'u'));
    fail(nameMatch, `Active plate derivative name is not source/pipeline-bound: ${derivative}`);
    const derivativePath = path.join(publicRoot, derivative.replace(/^\//, ''));
    fail(fs.existsSync(derivativePath), `Missing active plate derivative: ${derivative}`);
    const derivativeMetadata = await sharp(derivativePath).metadata();
    const expectedWidth = Number.parseInt(nameMatch[1], 10);
    const expectedHeight = Math.round((metadata.height * expectedWidth) / metadata.width);
    const expectedMediaType = nameMatch[2] === 'jpg' ? 'image/jpeg' : `image/${nameMatch[2]}`;
    fail(
      derivativeMetadata.width === expectedWidth
        && derivativeMetadata.height === expectedHeight
        && derivativeMetadata.mediaType === expectedMediaType
        && !derivativeMetadata.hasAlpha,
      `Active plate derivative geometry/format drifted: ${derivative}`,
    );
  }
}

const afterwordRecord = publicProvenance.assets.find((asset) => asset.logicalId === 'plate:pliny-younger-vesuvius-letters-atlas');
fail(afterwordRecord && afterwordRecord.editorialCrops === undefined, 'The opening atlas must not retain repeated folio crop delivery');
const folioMasterHashes = new Set();
for (const [folioKey, record] of vesuviusFolioRecords) {
  const source = VESUVIUS_FOLIO_SOURCES[record.artworkId];
  const responsive = IMAGE_SOURCES[record.logicalPath];
  const masterPath = path.join(root, record.sourceArtifact);
  fail(source && responsive, `Missing responsive Vesuvius source at ${folioKey}`);
  fail(fs.existsSync(masterPath), `Missing Vesuvius folio master at ${folioKey}`);
  fail(!fs.existsSync(path.join(publicRoot, record.logicalPath.replace(/^\//, ''))), `Vesuvius master is deployed directly at ${folioKey}`);
  const masterBytes = fs.readFileSync(masterPath);
  const masterSha256 = createHash('sha256').update(masterBytes).digest('hex');
  fail(masterSha256 === record.sourceSha256, `Vesuvius source hash drifted at ${folioKey}`);
  fail(!plateMasterHashes.has(masterSha256) && !folioMasterHashes.has(masterSha256), `Vesuvius source is byte-identical to another active master at ${folioKey}`);
  folioMasterHashes.add(masterSha256);
  const metadata = await sharp(masterBytes).metadata();
  fail(metadata.width === 1536 && metadata.height === 1024 && metadata.format === 'png' && !metadata.hasAlpha, `Vesuvius source geometry/format drifted at ${folioKey}`);
  fail(source.sourceSha256 === masterSha256 && responsive.sourceSha256 === masterSha256, `Vesuvius responsive hash drifted at ${folioKey}`);
  fail(source.logicalPath === record.logicalPath, `Vesuvius logical path drifted at ${folioKey}`);
  fail(source.derivatives.length === 4 && new Set(source.derivatives).size === 4, `Vesuvius derivative set is incomplete at ${folioKey}`);
  fail(JSON.stringify(source.derivatives) === JSON.stringify(responsive.derivatives), `Vesuvius responsive registries disagree at ${folioKey}`);
  const publicRecord = publicProvenance.assets.find((asset) => asset.logicalId === record.artworkId);
  fail(publicRecord?.folioKey === folioKey && publicRecord?.role === 'one-to-one modern editorial afterword folio illustration', `Vesuvius public provenance drifted at ${folioKey}`);
  const expectedNameHash = createHash('sha256').update(`${masterSha256}:${source.pipelineRevision}`).digest('hex').slice(0, 8);
  for (const derivative of source.derivatives) {
    fail(!declaredDerivativePaths.has(derivative), `Responsive derivative URL is reused: ${derivative}`);
    declaredDerivativePaths.add(derivative);
    const nameMatch = path.basename(derivative).match(new RegExp(`^[a-z0-9-]+\\.${expectedNameHash}\\.w(\\d+)\\.(avif|webp|jpg)$`, 'u'));
    fail(nameMatch, `Vesuvius derivative name is not source/pipeline-bound: ${derivative}`);
    const derivativePath = path.join(publicRoot, derivative.replace(/^\//, ''));
    fail(fs.existsSync(derivativePath), `Missing Vesuvius folio derivative: ${derivative}`);
    const derivativeMetadata = await sharp(derivativePath).metadata();
    const expectedWidth = Number.parseInt(nameMatch[1], 10);
    const expectedHeight = Math.round((metadata.height * expectedWidth) / metadata.width);
    const expectedMediaType = nameMatch[2] === 'jpg' ? 'image/jpeg' : `image/${nameMatch[2]}`;
    fail(
      derivativeMetadata.width === expectedWidth
        && derivativeMetadata.height === expectedHeight
        && derivativeMetadata.mediaType === expectedMediaType
        && !derivativeMetadata.hasAlpha,
      `Vesuvius folio derivative geometry/format drifted at ${folioKey}: ${derivative}`,
    );
  }
}
fail(folioMasterHashes.size === 12, 'Vesuvius folio source uniqueness drifted');

const routeInstances = new Set();
const renderedCompositions = new Set();
const usedChapterImages = new Set();
let ordinal = 0;
for (const bookMeta of manifest.books) {
  const book = JSON.parse(fs.readFileSync(path.join(publicRoot, bookMeta.file.replace(/^\//, '')), 'utf8'));
  for (const chapter of book.chapters) {
    const chapterKey = `${book.number}:${chapter.id}`;
    const source = CHAPTER_SCENE_AUDIT_SOURCES[chapterKey];
    const runtimeSource = chapterSceneSourceFor(book.number, chapter.id);
    const assignment = artworkManifest.assignments[chapterKey];
    const publicRecord = publicProvenance.assets.find((asset) => asset.logicalId === `chapter-scene:${chapterKey}`);
    fail(source && runtimeSource, `Missing chapter-scene audit/runtime source at ${chapterKey}`);
    const expectedDeliveryHash = createHash('sha256').update(`${source.sourceSha256}:${source.pipelineRevision}`).digest('hex').slice(0, 8);
    fail(CHAPTER_SCENE_DELIVERY_HASHES[chapterKey] === expectedDeliveryHash, `Lean delivery hash drifted at ${chapterKey}`);
    fail(
      runtimeSource.logicalPath === source.logicalPath
        && JSON.stringify(runtimeSource.desktop) === JSON.stringify(source.desktop)
        && JSON.stringify(runtimeSource.mobile) === JSON.stringify(source.mobile)
        && JSON.stringify(runtimeSource.derivatives) === JSON.stringify(source.derivatives),
      `Lean runtime delivery paths drifted from the audit registry at ${chapterKey}`,
    );
    fail(
      assignment?.kind === 'chapter-scene'
        && assignment.artworkId === `chapter-scene:${chapterKey}`
        && assignment.sourceArtifact === source.sourceArtifact
        && assignment.sourceSha256 === source.sourceSha256,
      `Certified one-to-one assignment drifted at ${chapterKey}`,
    );
    fail(
      publicRecord
        && JSON.stringify(publicRecord.derivatives) === JSON.stringify(source.derivatives)
        && JSON.stringify(publicRecord.derivativeSha256) === JSON.stringify(source.derivativeSha256),
      `Public/audit derivative hash ledger drifted at ${chapterKey}`,
    );
    const input = {
      bookNumber: book.number,
      bookRoman: book.roman,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      chapterLatinTitle: chapter.latinTitle,
      englishSubheadings: chapter.englishChapters,
      ordinal,
    };
    const illustration = chapterIllustration(input);
    const repeated = chapterIllustration(input);
    fail(JSON.stringify(illustration) === JSON.stringify(repeated), `Non-deterministic illustration at ${chapterKey}`);
    fail(!routeInstances.has(illustration.instanceKey), `Duplicate illustration instance at ${chapterKey}`);
    fail(!renderedCompositions.has(illustration.renderedKey), `Duplicate rendered composition at ${chapterKey}`);
    routeInstances.add(illustration.instanceKey);
    renderedCompositions.add(illustration.renderedKey);
    usedChapterImages.add(illustration.images[0]);
    fail(
      illustration.matchSource === 'chapter-scene'
        && illustration.semanticMatch === true
        && illustration.routeConfidence === 'high'
        && illustration.originalChapterScene === true
        && illustration.campaign === false,
      `Chapter route is not exclusively backed by its standalone scene at ${chapterKey}`,
    );
    fail(
      illustration.layout === 'hero'
        && illustration.panelCount === 1
        && illustration.panels.length === 1
        && illustration.images.length === 1
        && illustration.images[0] === runtimeSource.logicalPath
        && illustration.mainCell === null
        && illustration.detailCells === null,
      `Chapter route is not a single complete hero scene at ${chapterKey}`,
    );
    const panel = illustration.panels[0];
    fail(
      panel.label === 'I'
        && panel.field === 'main'
        && panel.cell === null
        && panel.source.viewerKind === 'chapter-scene'
        && panel.source.masterImage === runtimeSource.logicalPath
        && panel.source.desktopImage === runtimeSource.desktop.fallback
        && panel.source.mobileImage === runtimeSource.mobile.fallback
        && panel.source.viewerImage === runtimeSource.desktop.fallback
        && panel.source.viewerPreferredImage === runtimeSource.desktop.preload
        && panel.source.viewerImageSet === runtimeSource.desktop.imageSet
        && panel.source.description === undefined,
      `Chapter viewer source drifted at ${chapterKey}`,
    );
    fail(
      illustration.style['--plate-main-image'] === `url("${runtimeSource.desktop.fallback}")`
        && illustration.style['--plate-main-image-set'] === runtimeSource.desktop.imageSet
        && illustration.style['--plate-main-image-set-mobile'] === runtimeSource.mobile.imageSet
        && illustration.style['--plate-main-size'] === '100%'
        && illustration.style['--plate-main-x-offset'] === '0%'
        && illustration.style['--plate-main-y-offset'] === '0%',
      `Complete-scene framing drifted at ${chapterKey}`,
    );
    fail(/^.+\. Complete modern editorial illustration created specifically for this chapter\.$/u.test(illustration.alt), `Chapter-specific alt text drifted at ${chapterKey}`);
    fail(illustration.englishCaption.includes('EDITORIAL PLATE'), `Chapter-specific caption drifted at ${chapterKey}`);
    fail(source.derivatives.length === 4 && new Set(source.derivatives).size === 4, `Chapter derivative set is incomplete at ${chapterKey}`);
    fail(
      source.derivativeSha256
        && JSON.stringify(Object.keys(source.derivativeSha256)) === JSON.stringify(source.derivatives)
        && Object.values(source.derivativeSha256).every((digest) => /^[0-9a-f]{64}$/u.test(digest)),
      `Chapter derivative SHA-256 ledger is incomplete at ${chapterKey}`,
    );
    for (const derivative of source.derivatives) {
      fail(!declaredDerivativePaths.has(derivative), `Responsive derivative URL is reused: ${derivative}`);
      declaredDerivativePaths.add(derivative);
      const derivativePath = path.join(publicRoot, derivative.replace(/^\//, ''));
      fail(fs.existsSync(derivativePath), `Missing chapter derivative at ${chapterKey}: ${derivative}`);
      fail(sha256File(derivativePath) === source.derivativeSha256[derivative], `Chapter derivative bytes drifted at ${chapterKey}: ${derivative}`);
      fail(!/-cell-[a-z][0-9]\./u.test(derivative), `Atlas-cell derivative remains at ${chapterKey}: ${derivative}`);
    }
    ordinal += 1;
  }
}

fail(ordinal === canonicalChapterSceneCount, `Illustrated ${ordinal} chapters; expected ${canonicalChapterSceneCount}`);
fail(routeInstances.size === canonicalChapterSceneCount, 'Chapter illustration instance count drifted');
fail(renderedCompositions.size === canonicalChapterSceneCount, 'Chapter rendered-composition count drifted');
fail(usedChapterImages.size === canonicalChapterSceneCount, 'A chapter-scene source is reused');
fail(
  [...usedChapterImages].every((logicalPath) => Object.values(CHAPTER_SCENE_AUDIT_SOURCES).some((source) => source.logicalPath === logicalPath)),
  'A chapter route references a non-chapter visual',
);

const expectedDerivativeCount = canonicalChapterSceneCount * 4 + responsivePlatePaths.length * 4;
fail(declaredDerivativePaths.size === expectedDerivativeCount, `Expected ${expectedDerivativeCount} active illustration derivatives, found ${declaredDerivativePaths.size}`);
const deployedFiles = fs.readdirSync(path.join(publicRoot, 'assets'));
const deployedDerivativePaths = new Set(deployedFiles.map((file) => `/assets/${file}`));
fail(
  deployedDerivativePaths.size === declaredDerivativePaths.size
    && [...declaredDerivativePaths].every((derivative) => deployedDerivativePaths.has(derivative)),
  'Public assets contain missing or inactive illustration derivatives',
);
fail(deployedFiles.every((file) => /\.[a-f0-9]{8}\.w\d+\.(?:avif|webp|jpg)$/u.test(file)), 'A preservation master or unbound delivery file leaked into public assets');
fail(deployedFiles.every((file) => !/-cell-[a-z][0-9]\./u.test(file)), 'An atlas-cell derivative remains in public assets');
const deployedBytes = deployedFiles.reduce((sum, file) => sum + fs.statSync(path.join(publicRoot, 'assets', file)).size, 0);
const deployedBudget = (canonicalChapterSceneCount + 32) * 1024 * 1024;
fail(deployedBytes <= deployedBudget, `Responsive illustration budget exceeded: ${deployedBytes} bytes`);

console.log(
  `Verified ${canonicalChapterSceneCount.toLocaleString('en-US')} unique standalone chapter scenes, ${activePlatePaths.length} supplementary plates, 12 one-to-one Vesuvius folio illustrations, 0 atlas-cell library entries/routes/derivatives, and ${deployedDerivativePaths.size.toLocaleString('en-US')} exact responsive illustration files (${(deployedBytes / 1024 / 1024).toFixed(2)} MiB).`,
);
