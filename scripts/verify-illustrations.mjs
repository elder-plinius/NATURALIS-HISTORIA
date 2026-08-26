import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { CELL_IMAGE_SOURCES, IMAGE_SOURCES } from '../app/generated-image-sources.mjs';
import { CHAPTER_SCENE_SOURCES } from '../app/generated-chapter-scene-sources.mjs';
import {
  chapterIllustration,
  PANEL_MIN_FOCUS_DISTANCE,
  PLATE_IMAGE_PATHS,
  SIX_CELL_FOCI,
} from '../app/illustrations.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const manifest = JSON.parse(fs.readFileSync(path.join(publicRoot, 'corpus', 'manifest.json'), 'utf8'));
const generationCampaign = JSON.parse(fs.readFileSync(path.join(root, 'assets-source', 'plates-provenance.json'), 'utf8'));
const certifiedArtworkManifest = JSON.parse(fs.readFileSync(path.join(root, 'assets-source', 'chapter-artwork-manifest.json'), 'utf8'));
const generatedPlateCount = Object.keys(generationCampaign.assets).length;
const chapterSceneSourcesByLogicalPath = Object.fromEntries(
  Object.values(CHAPTER_SCENE_SOURCES).map((source) => [source.logicalPath, source]),
);
const cellIds = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'];
const cellSourceSize = 512;
const cellTrim = 0;
const cellFingerprintInset = 24;
const cellOutputSize = 512;
const campaignCellUrls = new Set();
const expectedCellSourcePaths = Object.keys(generationCampaign.assets).map((file) => `/assets/${file}`).sort();
if (JSON.stringify(Object.keys(CELL_IMAGE_SOURCES).sort()) !== JSON.stringify(expectedCellSourcePaths)) {
  throw new Error('Generated cell source map does not exactly match the receipt-backed campaign atlases');
}
const expectedMasters = PLATE_IMAGE_PATHS.map((image) => path.basename(image)).sort();
if (new Set(expectedMasters).size !== expectedMasters.length) throw new Error('Illustration registry repeats a master path');
const activeMasters = fs.readdirSync(path.join(root, 'assets-source', 'plates')).filter((file) => file.endsWith('.jpg')).sort();
if (JSON.stringify(activeMasters) !== JSON.stringify(expectedMasters)) {
  throw new Error('Active plate masters do not exactly match the illustration registry');
}

const masterHashes = new Set();
for (const image of PLATE_IMAGE_PATHS) {
  if (!/\.jpg$/i.test(image)) throw new Error(`Unsupported illustration master key: ${image}`);
  const source = IMAGE_SOURCES[image];
  if (!source) throw new Error(`Missing responsive source record: ${image}`);
  const masterPath = path.join(root, 'assets-source', 'plates', path.basename(image));
  if (!fs.existsSync(masterPath)) throw new Error(`Missing illustration master: ${image}`);
  if (fs.existsSync(path.join(publicRoot, image.replace(/^\//, '')))) throw new Error(`Plate master is deployed directly: ${image}`);
  const masterBytes = fs.readFileSync(masterPath);
  const masterSha256 = createHash('sha256').update(masterBytes).digest('hex');
  if (masterHashes.has(masterSha256)) throw new Error(`Byte-identical plate master detected: ${image}`);
  masterHashes.add(masterSha256);
  const masterMetadata = await sharp(masterBytes).metadata();
  if (!masterMetadata.width || !masterMetadata.height || masterMetadata.format !== 'jpeg' || masterMetadata.hasAlpha) {
    throw new Error(`Invalid opaque JPEG master: ${image}`);
  }
  const masterAspectRatio = masterMetadata.width / masterMetadata.height;
  if (masterMetadata.width < 1200 || masterMetadata.height < 800 || masterAspectRatio < 4 / 3 || masterAspectRatio > 16 / 9) {
    throw new Error(`Plate master is below the release geometry floor: ${image}`);
  }
  if (source.width !== masterMetadata.width || source.height !== masterMetadata.height) {
    throw new Error(`Responsive source geometry drifted: ${image}`);
  }
  if (source.sourceSha256 !== masterSha256) throw new Error(`Responsive source hash drifted: ${image}`);
  const expectedNameHash = createHash('sha256')
    .update(`${masterSha256}:${source.pipelineRevision}`)
    .digest('hex')
    .slice(0, 8);
  if (source.derivatives.length !== 4
    || new Set(source.derivatives).size !== 4
    || source.derivatives.filter((value) => value.endsWith('.avif')).length !== 2
    || source.derivatives.filter((value) => value.endsWith('.webp')).length !== 1
    || source.derivatives.filter((value) => value.endsWith('.jpg')).length !== 1) {
    throw new Error(`Incomplete responsive derivative set: ${image}`);
  }
  for (const derivative of source.derivatives) {
    const derivativePath = path.join(publicRoot, derivative.replace(/^\//, ''));
    if (!fs.existsSync(derivativePath)) throw new Error(`Missing deployed derivative: ${derivative}`);
    const nameMatch = path.basename(derivative).match(new RegExp(`^[a-z0-9-]+\\.${expectedNameHash}\\.w(\\d+)\\.(avif|webp|jpg)$`));
    if (!nameMatch) throw new Error(`Derivative name is not source/pipeline-bound: ${derivative}`);
    const expectedWidth = Number.parseInt(nameMatch[1], 10);
    const expectedHeight = Math.round((masterMetadata.height * expectedWidth) / masterMetadata.width);
    const expectedMediaType = nameMatch[2] === 'jpg' ? 'image/jpeg' : `image/${nameMatch[2]}`;
    const derivativeMetadata = await sharp(derivativePath).metadata();
    if (derivativeMetadata.width !== expectedWidth
      || derivativeMetadata.height !== expectedHeight
      || derivativeMetadata.mediaType !== expectedMediaType
      || derivativeMetadata.hasAlpha) {
      throw new Error(`Derivative geometry/format drifted: ${derivative}`);
    }
  }
}

for (const file of Object.keys(generationCampaign.assets)) {
  const masterPath = path.join(root, 'assets-source', 'plates', file);
  const logicalPath = `/assets/${file}`;
  const masterSha256 = createHash('sha256').update(fs.readFileSync(masterPath)).digest('hex');
  const metadata = await sharp(masterPath).metadata();
  if (metadata.width !== 1536 || metadata.height !== 1024 || metadata.hasAlpha) {
    throw new Error(`Generated master geometry drifted: ${file}`);
  }
  const responsiveSource = IMAGE_SOURCES[logicalPath];
  const expectedCellPipelineRevision = `${responsiveSource.pipelineRevision}:cell-trim${cellTrim}-w${cellOutputSize}:avif48-444:webp74:mozjpeg74`;
  if (JSON.stringify(Object.keys(CELL_IMAGE_SOURCES[logicalPath] ?? {})) !== JSON.stringify(cellIds)) {
    throw new Error(`Generated cell source ledger is incomplete or out of order: ${file}`);
  }
  for (const [index, cell] of cellIds.entries()) {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const expectedSourceCell = {
      left: column * cellSourceSize,
      top: row * cellSourceSize,
      width: cellSourceSize,
      height: cellSourceSize,
    };
    const expectedCrop = {
      left: expectedSourceCell.left + cellTrim,
      top: expectedSourceCell.top + cellTrim,
      width: cellSourceSize - cellTrim * 2,
      height: cellSourceSize - cellTrim * 2,
    };
    const cellSource = CELL_IMAGE_SOURCES[logicalPath][cell];
    if (cellSource.sourceSha256 !== masterSha256
      || cellSource.pipelineRevision !== expectedCellPipelineRevision
      || JSON.stringify(cellSource.sourceCell) !== JSON.stringify(expectedSourceCell)
      || JSON.stringify(cellSource.crop) !== JSON.stringify(expectedCrop)
      || cellSource.width !== cellOutputSize
      || cellSource.height !== cellOutputSize) {
      throw new Error(`Generated cell source geometry or master binding drifted: ${file}#${cell}`);
    }
    const expectedHash = createHash('sha256')
      .update(`${masterSha256}:${cell}:${JSON.stringify(expectedCrop)}:${cellOutputSize}:${expectedCellPipelineRevision}`)
      .digest('hex')
      .slice(0, 8);
    if (cellSource.derivatives.length !== 3
      || new Set(cellSource.derivatives).size !== 3
      || cellSource.fallback !== cellSource.derivatives.find((value) => value.endsWith('.jpg'))
      || cellSource.preload !== cellSource.derivatives.find((value) => value.endsWith('.avif'))
      || cellSource.imageSet !== `image-set(url("${cellSource.derivatives[0]}") type("image/avif") 1x, url("${cellSource.derivatives[1]}") type("image/webp") 1x)`) {
      throw new Error(`Generated cell source set is incomplete: ${file}#${cell}`);
    }
    let cellBytes = 0;
    for (const derivative of cellSource.derivatives) {
      if (campaignCellUrls.has(derivative)) throw new Error(`Generated cell URL is reused: ${derivative}`);
      campaignCellUrls.add(derivative);
      const nameMatch = path.basename(derivative).match(new RegExp(`^${path.basename(file, '.jpg')}-cell-${cell.toLowerCase()}\\.${expectedHash}\\.w${cellOutputSize}\\.(avif|webp|jpg)$`));
      if (!nameMatch) throw new Error(`Generated cell URL is not source/crop/pipeline-bound: ${derivative}`);
      const derivativePath = path.join(publicRoot, derivative.replace(/^\//, ''));
      if (!fs.existsSync(derivativePath)) throw new Error(`Missing generated cell derivative: ${derivative}`);
      const derivativeMetadata = await sharp(derivativePath).metadata();
      const expectedMediaType = nameMatch[1] === 'jpg' ? 'image/jpeg' : `image/${nameMatch[1]}`;
      if (derivativeMetadata.width !== cellOutputSize
        || derivativeMetadata.height !== cellOutputSize
        || derivativeMetadata.mediaType !== expectedMediaType
        || derivativeMetadata.hasAlpha) {
        throw new Error(`Generated cell derivative geometry/format drifted: ${derivative}`);
      }
      cellBytes += fs.statSync(derivativePath).size;
    }
    if (cellBytes > 0.24 * 1024 * 1024) throw new Error(`Generated cell derivative budget exceeded: ${file}#${cell} (${cellBytes} bytes)`);
  }
  const fingerprints = [];
  const differenceHashes = [];
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      // Ignore the common drawn frame only for similarity measurement; public
      // cell derivatives above still preserve every source pixel.
      const crop = {
        left: column * 512 + cellFingerprintInset,
        top: row * 512 + cellFingerprintInset,
        width: 512 - cellFingerprintInset * 2,
        height: 512 - cellFingerprintInset * 2,
      };
      const { data } = await sharp(masterPath)
        .extract(crop)
        .resize(64, 64, { fit: 'fill' })
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
      fingerprints.push(data);
      const { data: hashData } = await sharp(masterPath)
        .extract(crop)
        .resize(9, 8, { fit: 'fill' })
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const bits = [];
      for (let hashRow = 0; hashRow < 8; hashRow += 1) {
        for (let hashColumn = 0; hashColumn < 8; hashColumn += 1) {
          bits.push(hashData[hashRow * 9 + hashColumn] > hashData[hashRow * 9 + hashColumn + 1]);
        }
      }
      differenceHashes.push(bits);
    }
  }
  for (let left = 0; left < fingerprints.length; left += 1) {
    for (let right = left + 1; right < fingerprints.length; right += 1) {
      let difference = 0;
      for (let index = 0; index < fingerprints[left].length; index += 1) {
        difference += Math.abs(fingerprints[left][index] - fingerprints[right][index]);
      }
      const meanDifference = difference / fingerprints[left].length;
      const hashDistance = differenceHashes[left].reduce((sum, bit, index) => sum + Number(bit !== differenceHashes[right][index]), 0);
      if (meanDifference < 24 || hashDistance < 16) {
        throw new Error(`${file} has near-duplicate cells ${left + 1} and ${right + 1}: MAD ${meanDifference.toFixed(2)}, dHash ${hashDistance}`);
      }
    }
  }
}

const deployedPlateFiles = fs.readdirSync(path.join(publicRoot, 'assets'));
if (deployedPlateFiles.some((file) => /\.png$/i.test(file) || (/\.jpe?g$/i.test(file) && !/\.[a-f0-9]{8}\.w\d+\.jpg$/.test(file)))) {
  throw new Error('A preservation master leaked into public assets');
}
const deployedPlateBytes = deployedPlateFiles.reduce((sum, file) => sum + fs.statSync(path.join(publicRoot, 'assets', file)).size, 0);
const deployedBudget = (50 + Object.keys(CHAPTER_SCENE_SOURCES).length) * 1024 * 1024;
if (deployedPlateBytes > deployedBudget) throw new Error(`Responsive plate budget exceeded: ${deployedPlateBytes} bytes`);
if (campaignCellUrls.size !== generatedPlateCount * cellIds.length * 3) {
  throw new Error(`Expected ${generatedPlateCount * cellIds.length * 3} unique generated cell URLs, found ${campaignCellUrls.size}`);
}

const instances = new Set();
const studies = new Set();
const panels = new Set();
const renderedCompositions = new Set();
const routeRecords = [];
const families = new Map();
const usedImages = new Set();
const illustrations = new Map();
const subjects = new Set();
const layouts = new Set();
const generatedMainCells = new Set();
let titleMatches = 0;
let subheadingMatches = 0;
let curatedRoutes = 0;
let campaignRoutes = 0;
let certifiedAtlasRoutes = 0;
let originalChapterRoutes = 0;
let fallbackRoutes = 0;
let ordinal = 0;

for (const meta of manifest.books) {
  const book = JSON.parse(fs.readFileSync(path.join(publicRoot, meta.file.replace(/^\//, '')), 'utf8'));
  for (const chapter of book.chapters) {
    const illustration = chapterIllustration({
      bookNumber: book.number,
      bookRoman: book.roman,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      chapterLatinTitle: chapter.latinTitle,
      englishSubheadings: chapter.englishChapters,
      ordinal,
    });
    const repeated = chapterIllustration({
      bookNumber: book.number,
      bookRoman: book.roman,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      chapterLatinTitle: chapter.latinTitle,
      englishSubheadings: chapter.englishChapters,
      ordinal,
    });
    if (['instanceKey', 'studyKey', 'panelKey', 'renderedKey', 'layout', 'panelCount']
      .some((key) => illustration[key] !== repeated[key])
      || JSON.stringify(illustration.panels) !== JSON.stringify(repeated.panels)) {
      throw new Error(`Non-deterministic illustration at Book ${book.roman}, ${chapter.id}`);
    }
    if (instances.has(illustration.instanceKey)) {
      throw new Error(`Duplicate route instance at Book ${book.roman}, ${chapter.id}`);
    }
    instances.add(illustration.instanceKey);
    studies.add(illustration.studyKey);
    panels.add(illustration.panelKey);
    renderedCompositions.add(illustration.renderedKey);
    const renderedCompositionSource = illustration.certifiedAtlasOverride
      ? `${illustration.images[0]}#${illustration.mainCell}`
      : illustration.images[0];
    const geometryKey = [
      renderedCompositionSource,
      illustration.layout,
      illustration.panelCount,
      ...illustration.panels.flatMap((panel) => [
        illustration.style[`--plate-${panel.field}-x`],
        illustration.style[`--plate-${panel.field}-y`],
        illustration.style[`--plate-${panel.field}-size`],
        illustration.style[`--plate-${panel.field}-x-offset`],
        illustration.style[`--plate-${panel.field}-y-offset`],
      ]),
    ].join('|');
    if (geometryKey !== illustration.renderedKey) {
      throw new Error(`Rendered key contains non-geometric data at Book ${book.roman}, ${chapter.id}`);
    }
    routeRecords.push({ route: `${book.number}:${chapter.id}`, bookNumber: book.number, illustration });
    families.set(illustration.family, (families.get(illustration.family) ?? 0) + 1);
    subjects.add(illustration.subject);
    layouts.add(illustration.layout);
    if (illustration.matchSource === 'title') titleMatches += 1;
    else if (illustration.matchSource === 'subheading') subheadingMatches += 1;
    else if (illustration.matchSource === 'curated') curatedRoutes += 1;
    else if (illustration.matchSource === 'campaign') campaignRoutes += 1;
    else if (illustration.matchSource === 'certified-atlas-cell') certifiedAtlasRoutes += 1;
    else if (illustration.matchSource === 'chapter-scene') originalChapterRoutes += 1;
    else if (illustration.matchSource === 'fallback') fallbackRoutes += 1;
    else throw new Error(`Unknown match source at Book ${book.roman}, ${chapter.id}: ${illustration.matchSource}`);
    if (illustration.semanticMatch !== (illustration.matchSource !== 'fallback')) {
      throw new Error(`Semantic flag disagrees with match source at Book ${book.roman}, ${chapter.id}`);
    }
    if (illustration.campaign) {
      if (!illustration.mainCell || !generationCampaign.assets[path.basename(illustration.images[0])]) {
        throw new Error(`Campaign route lacks a receipt-backed main cell at Book ${book.roman}, ${chapter.id}`);
      }
      generatedMainCells.add(`${path.basename(illustration.images[0])}#${illustration.mainCell}`);
    }
    if (illustration.images.length !== 1) throw new Error(`Plate has undeclared supporting assets at Book ${book.roman}, ${chapter.id}`);
    const responsiveSource = IMAGE_SOURCES[illustration.images[0]]
      ?? chapterSceneSourcesByLogicalPath[illustration.images[0]];
    if (!responsiveSource) throw new Error(`Missing responsive source at Book ${book.roman}, ${chapter.id}`);
    const expectedFields = illustration.panelCount === 1
      ? ['main']
      : illustration.panelCount === 3
        ? ['main', 'detail-one', 'detail-two']
        : null;
    if (!expectedFields || illustration.panels?.length !== illustration.panelCount) {
      throw new Error(`Plate has an invalid authoritative panel count at Book ${book.roman}, ${chapter.id}`);
    }
    const expectedLabels = ['I', 'II', 'III'].slice(0, illustration.panelCount);
    if (illustration.panels.some((panel, index) => panel.field !== expectedFields[index] || panel.label !== expectedLabels[index])) {
      throw new Error(`Plate descriptors do not match rendered fields at Book ${book.roman}, ${chapter.id}`);
    }
    if (illustration.panelCount === 1 && (illustration.layout !== 'hero' || illustration.detailCells !== null)) {
      throw new Error(`Single-study plate is not a true hero composition at Book ${book.roman}, ${chapter.id}`);
    }
    if (illustration.layout === 'triptych' && illustration.panelCount !== 3) {
      throw new Error(`Triptych does not declare three rendered panels at Book ${book.roman}, ${chapter.id}`);
    }
    if (illustration.panels[0].focus[0] !== illustration.focus[0]
      || illustration.panels[0].focus[1] !== illustration.focus[1]
      || illustration.panels[0].cell !== illustration.mainCell) {
      throw new Error(`Principal panel descriptor drifted at Book ${book.roman}, ${chapter.id}`);
    }
    const describedDetailCells = illustration.panels.slice(1).map((panel) => panel.cell);
    if (illustration.detailCells === null
      ? describedDetailCells.some((cell) => cell !== null)
      : JSON.stringify(describedDetailCells) !== JSON.stringify(illustration.detailCells)) {
      throw new Error(`Detail-cell metadata drifted at Book ${book.roman}, ${chapter.id}`);
    }
    for (let left = 0; left < illustration.panels.length; left += 1) {
      const panel = illustration.panels[left];
      if (!Array.isArray(panel.focus) || panel.focus.length !== 2 || panel.focus.some((value) => !Number.isFinite(value))) {
        throw new Error(`Panel focus is invalid at Book ${book.roman}, ${chapter.id}, panel ${panel.label}`);
      }
      if (!panel.accessibleLabel.includes(`panel ${panel.label}`)
        || panel.source?.masterImage !== illustration.images[0]
        || panel.source?.desktopImage !== responsiveSource.desktop.fallback
        || panel.source?.mobileImage !== responsiveSource.mobile.fallback
        || typeof panel.source?.asset !== 'string'
        || typeof panel.source?.description !== 'string') {
        throw new Error(`Panel source/accessibility metadata drifted at Book ${book.roman}, ${chapter.id}, panel ${panel.label}`);
      }
      const expectedViewerSource = panel.cell
        ? CELL_IMAGE_SOURCES[illustration.images[0]]?.[panel.cell]
        : null;
      if (expectedViewerSource
        ? (panel.source.viewerKind !== 'cell'
          || panel.source.viewerImage !== expectedViewerSource.fallback
          || panel.source.viewerPreferredImage !== expectedViewerSource.preload
          || panel.source.viewerImageSet !== expectedViewerSource.imageSet)
        : illustration.originalChapterScene
          ? (panel.source.viewerKind !== 'chapter-scene'
            || panel.source.viewerImage !== responsiveSource.desktop.fallback
            || panel.source.viewerPreferredImage !== responsiveSource.desktop.preload
            || panel.source.viewerImageSet !== responsiveSource.desktop.imageSet)
          : (panel.source.viewerKind !== 'atlas'
          || panel.source.viewerImage !== responsiveSource.desktop.fallback
          || panel.source.viewerPreferredImage !== responsiveSource.desktop.preload
          || panel.source.viewerImageSet !== responsiveSource.desktop.imageSet)) {
        throw new Error(`Panel viewer source drifted at Book ${book.roman}, ${chapter.id}, panel ${panel.label}`);
      }
      for (let right = left + 1; right < illustration.panels.length; right += 1) {
        const distance = Math.hypot(
          panel.focus[0] - illustration.panels[right].focus[0],
          panel.focus[1] - illustration.panels[right].focus[1],
        );
        if (distance < PANEL_MIN_FOCUS_DISTANCE) {
          throw new Error(`Panels ${panel.label}/${illustration.panels[right].label} are only ${distance.toFixed(2)} percentage points apart at Book ${book.roman}, ${chapter.id}`);
        }
      }
    }
    const panelStudies = illustration.panels.map((panel) => panel.cell ?? panel.focus.join(','));
    if (illustration.studyKey !== [illustration.images[0], panelStudies[0]].join('|')
      || illustration.panelKey !== [illustration.images[0], illustration.layout, illustration.panelCount, ...panelStudies].join('|')) {
      throw new Error(`Panel identity contains undeclared data at Book ${book.roman}, ${chapter.id}`);
    }
    const cropKeys = illustration.panels.map((panel) =>
      `${illustration.style[`--plate-${panel.field}-x`]}:${illustration.style[`--plate-${panel.field}-y`]}:${illustration.style[`--plate-${panel.field}-size`]}:${illustration.style[`--plate-${panel.field}-x-offset`]}:${illustration.style[`--plate-${panel.field}-y-offset`]}`);
    if (new Set(cropKeys).size !== illustration.panelCount) throw new Error(`Repeated plate crop at Book ${book.roman}, ${chapter.id}`);
    if (illustration.campaign && illustration.panelCount === 3) {
      if (!illustration.mainCell || illustration.detailCells?.length !== 2) {
        throw new Error(`Campaign composition lacks its certified six-cell route at Book ${book.roman}, ${chapter.id}`);
      }
      const cellIds = [illustration.mainCell, ...illustration.detailCells];
      if (new Set(cellIds).size !== 3) throw new Error(`Campaign composition repeats a named cell at Book ${book.roman}, ${chapter.id}`);
      if (new Set(illustration.panels.map((panel) => panel.source.viewerImage)).size !== 3) {
        throw new Error(`Campaign composition repeats a fullscreen cell URL at Book ${book.roman}, ${chapter.id}`);
      }
      const points = cellIds.map((cell) => SIX_CELL_FOCI[cell]);
      for (let left = 0; left < points.length; left += 1) {
        for (let right = left + 1; right < points.length; right += 1) {
          if (Math.hypot(points[left][0] - points[right][0], points[left][1] - points[right][1]) < PANEL_MIN_FOCUS_DISTANCE) {
            throw new Error(`Campaign cells are too close at Book ${book.roman}, ${chapter.id}`);
          }
        }
      }
    }
    const panelSizes = illustration.panels.map((panel) => Number.parseFloat(illustration.style[`--plate-${panel.field}-size`]));
    if (panelSizes[0] < 100
      || (panelSizes.length === 3 && (panelSizes[1] <= panelSizes[0] || panelSizes[2] <= panelSizes[1]))) {
      throw new Error(`Unsafe subject-first zoom at Book ${book.roman}, ${chapter.id}`);
    }
    for (const { field } of illustration.panels) {
      const size = Number.parseFloat(illustration.style[`--plate-${field}-size`]);
      for (const axis of ['x', 'y']) {
        const offset = Number.parseFloat(illustration.style[`--plate-${field}-${axis}-offset`]);
        if (offset > 0.01 || offset < 100 - size - 0.011) {
          throw new Error(`Cover layer can expose vellum in ${field} at Book ${book.roman}, ${chapter.id}`);
        }
      }
    }
    const renderedSource = illustration.certifiedAtlasOverride
      ? CELL_IMAGE_SOURCES[illustration.images[0]]?.[illustration.mainCell]
      : responsiveSource;
    if (!renderedSource) throw new Error(`Missing rendered source at Book ${book.roman}, ${chapter.id}`);
    const expectedCssImage = `url("${renderedSource.fallback ?? renderedSource.desktop.fallback}")`;
    const expectedDesktopSet = renderedSource.imageSet ?? renderedSource.desktop.imageSet;
    const expectedMobileSet = renderedSource.imageSet ?? renderedSource.mobile.imageSet;
    for (const { field } of illustration.panels) {
      if (illustration.style[`--plate-${field}-image`] !== expectedCssImage) {
        throw new Error(`Off-subject supporting image in ${field} at Book ${book.roman}, ${chapter.id}`);
      }
      if (illustration.style[`--plate-${field}-image-set`] !== expectedDesktopSet) throw new Error(`Desktop source set drifted in ${field} at Book ${book.roman}, ${chapter.id}`);
      if (illustration.style[`--plate-${field}-image-set-mobile`] !== expectedMobileSet) throw new Error(`Mobile source set drifted in ${field} at Book ${book.roman}, ${chapter.id}`);
    }
    for (const field of ['main', 'detail-one', 'detail-two'].filter((field) => !expectedFields.includes(field))) {
      if (Object.hasOwn(illustration.style, `--plate-${field}-image`)) {
        throw new Error(`Single-study plate declares an unrendered ${field} layer at Book ${book.roman}, ${chapter.id}`);
      }
    }
    const validAtlasAlt = /^.+\. (?:One focal study|Three separated focal studies) from a single modern antiquarian (?:natural-history plate depicting|book-family plate for) .+\.$/.test(illustration.alt);
    const validChapterAlt = illustration.originalChapterScene
      && /^.+\. Complete modern editorial illustration created specifically for this chapter\.$/.test(illustration.alt);
    if (!validAtlasAlt && !validChapterAlt) {
      throw new Error(`Plate alt is not crop-specific at Book ${book.roman}, ${chapter.id}`);
    }
    if (!['high', 'medium', 'broad'].includes(illustration.routeConfidence)) {
      throw new Error(`Plate confidence is invalid at Book ${book.roman}, ${chapter.id}`);
    }
    illustration.images.forEach((image) => usedImages.add(image));
    illustrations.set(`${book.number}:${chapter.id}`, illustration);
    ordinal += 1;
  }
}

if (ordinal !== manifest.totalChapters) {
  throw new Error(`Illustrated ${ordinal} sections; manifest declares ${manifest.totalChapters}`);
}

for (const [chapterKey, assignment] of Object.entries(certifiedArtworkManifest.assignments ?? {})) {
  const illustration = illustrations.get(chapterKey);
  if (!illustration) throw new Error(`Certified artwork route is missing: ${chapterKey}`);
  if (assignment.kind === 'chapter-scene') {
    const expectedSource = CHAPTER_SCENE_SOURCES[chapterKey];
    if (!expectedSource
      || illustration.matchSource !== 'chapter-scene'
      || illustration.images[0] !== expectedSource.logicalPath
      || illustration.panelCount !== 1) {
      throw new Error(`Certified one-to-one chapter scene is not rendered at ${chapterKey}`);
    }
  } else if (assignment.kind === 'atlas-cell') {
    const expectedImage = `/assets/${path.basename(assignment.sourceArtifact)}`;
    if (illustration.images[0] !== expectedImage
      || illustration.mainCell !== assignment.cell
      || illustration.panels[0]?.source.viewerKind !== 'cell') {
      throw new Error(`Certified atlas cell is not rendered at ${chapterKey}: ${assignment.artworkId}`);
    }
  } else {
    throw new Error(`Unknown certified artwork kind at ${chapterKey}: ${assignment.kind}`);
  }
}

if (instances.size !== manifest.totalChapters) {
  throw new Error(`Expected ${manifest.totalChapters} route instances; found ${instances.size}`);
}

if (studies.size < 200 || panels.size < 900 || renderedCompositions.size !== manifest.totalChapters) {
  throw new Error(`Visual diversity fell below the evidence floor: ${studies.size} main studies, ${panels.size} panel compositions, ${renderedCompositions.size} exact rendered compositions`);
}

function maximumUse(key) {
  const counts = new Map();
  for (const record of routeRecords) {
    const value = record.illustration[key];
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Math.max(...counts.values());
}

if (maximumUse('panelKey') > 12 || maximumUse('renderedKey') !== 1) {
  throw new Error(`A route-free composition is overused: panel max ${maximumUse('panelKey')}, rendered max ${maximumUse('renderedKey')}`);
}

let panelRun = 1;
for (let index = 1; index < routeRecords.length; index += 1) {
  const previous = routeRecords[index - 1];
  const current = routeRecords[index];
  if (current.illustration.renderedKey === previous.illustration.renderedKey) {
    throw new Error(`Adjacent leaves repeat an exact rendered composition at ${previous.route} and ${current.route}`);
  }
  panelRun = current.illustration.panelKey === previous.illustration.panelKey ? panelRun + 1 : 1;
  if (panelRun > 3) throw new Error(`A panel composition repeats more than three times in sequence at ${current.route}`);
}

for (const meta of manifest.books) {
  const bookRecords = routeRecords.filter((record) => record.bookNumber === meta.number);
  const uniqueRendered = new Set(bookRecords.map((record) => record.illustration.renderedKey)).size;
  if (uniqueRendered !== bookRecords.length) {
    throw new Error(`Book ${meta.roman} has only ${uniqueRendered}/${bookRecords.length} exact rendered compositions`);
  }
}

const certifiedAssignments = Object.entries(certifiedArtworkManifest.assignments ?? {});
const expectedOriginalRoutes = certifiedAssignments.filter(([, assignment]) => assignment.kind === 'chapter-scene').length;
const expectedAtlasRoutes = certifiedAssignments.filter(([, assignment]) => assignment.kind === 'atlas-cell').length;
if (originalChapterRoutes !== expectedOriginalRoutes
  || certifiedAtlasRoutes !== expectedAtlasRoutes
  || titleMatches + subheadingMatches + curatedRoutes + campaignRoutes + fallbackRoutes !== 0
  || originalChapterRoutes + certifiedAtlasRoutes !== ordinal) {
  throw new Error(`Certified routing drifted: expected ${expectedOriginalRoutes} chapter scenes and ${expectedAtlasRoutes} atlas cells; found ${originalChapterRoutes} chapter scenes, ${certifiedAtlasRoutes} atlas cells, ${curatedRoutes} curated routes, ${campaignRoutes} campaign routes, ${titleMatches} title routes, ${subheadingMatches} subheading routes, and ${fallbackRoutes} fallbacks`);
}
const expectedUsedImages = new Set(certifiedAssignments.map(([chapterKey, assignment]) => assignment.kind === 'chapter-scene'
  ? CHAPTER_SCENE_SOURCES[chapterKey]?.logicalPath
  : `/assets/${path.basename(assignment.sourceArtifact)}`));
if (expectedUsedImages.has(undefined)
  || subjects.size !== manifest.totalChapters
  || layouts.size !== 1
  || !layouts.has('hero')
  || usedImages.size !== expectedUsedImages.size
  || [...usedImages].some((image) => !expectedUsedImages.has(image))) {
  throw new Error(`Expected one hero subject per certified chapter and exactly ${expectedUsedImages.size} assigned primary sources; found ${subjects.size} subjects, ${usedImages.size} primary sources, and ${[...layouts].join(', ') || 'no'} layouts`);
}

const declaredGeneratedCells = Object.entries(generationCampaign.assets)
  .flatMap(([file, record]) => Object.keys(record.cells ?? {}).map((cell) => `${file}#${cell}`));
if (new Set(declaredGeneratedCells).size !== generatedPlateCount * 6) {
  throw new Error('Receipt-backed atlas cell ledger is incomplete or repeats a source scene');
}

for (const file of Object.keys(generationCampaign.assets)) {
  const source = IMAGE_SOURCES[`/assets/${file}`];
  const derivativeBytes = source.derivatives.reduce((sum, derivative) =>
    sum + fs.statSync(path.join(publicRoot, derivative.replace(/^\//, ''))).size, 0);
  if (derivativeBytes > 0.78 * 1024 * 1024) {
    throw new Error(`${file} exceeds the generated-plate derivative budget: ${derivativeBytes}`);
  }
}

const criticalCampaignRoutes = [
  ['11:37', '/assets/comparative-animal-anatomy-atlas.jpg', 'B3'],
  ['19:4', '/assets/roman-agriculture-gardens-atlas.jpg', 'A1'],
  ['21:5', '/assets/cultivated-materia-medica-atlas.jpg', 'B1'],
  ['22:25', '/assets/trees-reeds-grain-craft-atlas.jpg', 'A3'],
  ['23:1', '/assets/trees-reeds-grain-craft-atlas.jpg', 'A1'],
  ['24:11', '/assets/trees-reeds-grain-craft-atlas.jpg', 'A2'],
  ['25:8', '/assets/wild-plants-animal-remedies-atlas.jpg', 'A1'],
  ['25:10', '/assets/wild-plants-animal-remedies-atlas.jpg', 'A2'],
  ['29:1', '/assets/wild-plants-animal-remedies-atlas.jpg', 'B2'],
  ['31:11', '/assets/aquatic-materia-medica-atlas.jpg', 'A1'],
  ['33:2', '/assets/roman-metals-arts-stones-atlas.jpg', 'A1'],
  ['33:9', '/assets/roman-metals-arts-stones-atlas.jpg', 'A2'],
  ['34:3', '/assets/roman-metals-arts-stones-atlas.jpg', 'A3'],
  ['2:30', '/assets/cosmos-celestial-mechanics-atlas.jpg', 'A2'],
  ['2:94', '/assets/earth-processes-ocean-atlas.jpg', 'B1'],
  ['3:10', '/assets/western-roman-regions-atlas.jpg', 'A3'],
  ['5:10', '/assets/eastern-southern-regions-atlas.jpg', 'A2'],
  ['7:30', '/assets/human-life-capacities-atlas.jpg', 'A3'],
  ['11:30', '/assets/insect-societies-lifecycles-atlas.jpg', 'A3'],
  ['12:2', '/assets/tree-species-arboriculture-atlas.jpg', 'A1'],
  ['20:1', '/assets/cultivated-materia-medica-atlas.jpg', 'A1'],
];
for (const [route, image, cell] of criticalCampaignRoutes) {
  const illustration = illustrations.get(route);
  if (illustration?.originalChapterScene) continue;
  if (illustration?.images[0] !== image || illustration.mainCell !== cell) {
    throw new Error(`Critical campaign routing drifted at ${route}`);
  }
}

const fishSequence = Array.from({ length: 10 }, (_, index) => illustrations.get(`9:${index + 19}`));
if (fishSequence.some((illustration) => !illustration || illustration.panelCount !== 1)
  || new Set(fishSequence.map((illustration) => illustration.renderedKey)).size !== fishSequence.length) {
  throw new Error('Book IX.19–28 does not retain ten distinct one-panel certified studies');
}

const eggRoutes = ['10:9', '10:31', '10:53', '10:55', '10:58', '10:59', '10:60'].map((route) => illustrations.get(route));
if (eggRoutes.some((illustration) => !illustration || illustration.panelCount !== 1)
  || new Set(eggRoutes.map((illustration) => illustration.renderedKey)).size !== eggRoutes.length) {
  throw new Error('The egg sequence does not retain seven distinct one-panel certified studies');
}

const anatomySequence = Array.from({ length: 18 }, (_, index) => illustrations.get(`11:${index + 37}`));
let anatomyRun = 1;
for (let index = 1; index < anatomySequence.length; index += 1) {
  anatomyRun = anatomySequence[index]?.visualSignature === anatomySequence[index - 1]?.visualSignature ? anatomyRun + 1 : 1;
  if (anatomyRun > 2) throw new Error('Book XI.37–54 repeats one visual signature more than twice');
}

const semanticFixtures = [
  ['1:praef', 'dedication', 'curated', '/assets/dedication-pliny-vespasian.jpg', [50, 50], 'the dedication'],
  ['2:24', 'comets', 'title', '/assets/celestial-weather-phenomena-atlas.jpg', [85, 12], 'comets'],
  ['2:10', 'cosmos-mechanics-a2', 'campaign', '/assets/cosmos-celestial-mechanics-atlas.jpg', [50, 25], 'eclipses'],
  ['2:39', 'cosmos-mechanics-a3', 'campaign', '/assets/cosmos-celestial-mechanics-atlas.jpg', [84, 25], 'seasons, not seas'],
  ['2:48', 'sky-whirlwinds', 'curated', '/assets/sky-measure-prodigies-atlas.jpg', [62, 50], 'typhon and whirlwinds'],
  ['2:57', 'sky-sounds', 'curated', '/assets/sky-measure-prodigies-atlas.jpg', [38, 82], 'sounds in the sky'],
  ['2:62', 'local-weather', 'curated', '/assets/sky-measure-prodigies-atlas.jpg', [62, 82], 'weather by place'],
  ['2:72', 'sky-timekeeping', 'curated', '/assets/sky-measure-prodigies-atlas.jpg', [38, 50], 'gnomon and dials'],
  ['2:79', 'earth-ocean-a3', 'campaign', '/assets/earth-processes-ocean-atlas.jpg', [84, 25], 'earthquakes and clefts'],
  ['2:103', 'earth-ocean-b2', 'campaign', '/assets/earth-processes-ocean-atlas.jpg', [50, 75], 'springs and rivers'],
  ['2:107', 'earth-ocean-b3', 'campaign', '/assets/earth-processes-ocean-atlas.jpg', [84, 75], 'wonders of earthly fire, not the later Vesuvius letters'],
  ['2:108', 'earth-ocean-a1', 'campaign', '/assets/earth-processes-ocean-atlas.jpg', [16, 25], 'dimensions of the Earth'],
  ['7:38', 'human-arts', 'title', '/assets/minerals-metals-arts-atlas-v2.jpg', [47, 72], 'painting, not pain or ivory'],
  ['7:9', 'birth', 'title', '/assets/roman-medicine-anatomy-care-atlas.jpg', [88, 25], 'birth by incision'],
  ['7:10', 'human-generation', 'curated', '/assets/human-life-belief-atlas.jpg', [16, 18], 'twins and survival'],
  ['7:22', 'senses', 'title', '/assets/roman-medicine-anatomy-care-atlas.jpg', [67, 24], 'hearing'],
  ['8:1', 'elephant-intelligence', 'title', '/assets/elephant-life-actions-atlas.jpg', [49, 22], 'elephants'],
  ['8:14', 'reptiles', 'title', '/assets/birds-insects-reptiles-atlas.jpg', [52, 82], 'serpents'],
  ['8:18', 'camels', 'title', '/assets/terrestrial-quadrupeds-atlas.jpg', [38, 82], 'camels'],
  ['8:25', 'crocodiles', 'title', '/assets/marine-life-atlas.jpg', [18, 84], 'crocodile'],
  ['8:31', 'amphibians', 'title', '/assets/rare-terrestrial-life-atlas.jpg', [16, 82], 'bramble-frogs'],
  ['8:35', 'porcupines', 'title', '/assets/rare-terrestrial-life-atlas.jpg', [62, 18], 'porcupines'],
  ['8:47', 'sheep', 'title', '/assets/rare-terrestrial-life-atlas.jpg', [38, 50], 'sheep'],
  ['8:50', 'goats', 'title', '/assets/rare-terrestrial-life-atlas.jpg', [62, 82], 'goats'],
  ['8:54', 'apes', 'title', '/assets/rare-terrestrial-life-atlas.jpg', [38, 18], 'apes'],
  ['9:6', 'fish-campaign-a1', 'campaign', '/assets/fish-forms-behaviour-atlas.jpg', [16, 25], 'balaena and orca'],
  ['9:30', 'fish-campaign-b2', 'campaign', '/assets/fish-forms-behaviour-atlas.jpg', [50, 75], 'polypi'],
  ['9:31', 'crustaceans', 'title', '/assets/creatures-papyrus-lacuna-atlas.jpg', [25, 25], 'crabs and urchins'],
  ['9:36', 'purple-dyes', 'title', '/assets/marine-waters-remedies.jpg', [19, 82], 'purple dyes'],
  ['9:45', 'sea-nettle', 'curated', '/assets/marine-invertebrate-atlas.jpg', [16, 18], 'sea-nettle and plant-like marine life'],
  ['10:2', 'phoenix', 'title', '/assets/birds-insects-flight.jpg', [60, 49], 'phoenix'],
  ['10:10', 'kites', 'title', '/assets/birds-domestic-insects-atlas.jpg', [16, 50], 'kite'],
  ['10:20', 'peacocks', 'title', '/assets/birds-domestic-insects-atlas.jpg', [84, 82], 'peacock'],
  ['10:21', 'roosters', 'title', '/assets/birds-domestic-insects-atlas.jpg', [84, 18], 'rooster'],
  ['10:22', 'geese', 'title', '/assets/birds-domestic-insects-atlas.jpg', [62, 18], 'goose'],
  ['10:34', 'pigeons', 'title', '/assets/birds-domestic-insects-atlas.jpg', [38, 18], 'pigeons'],
  ['10:42', 'parrots', 'title', '/assets/birds-domestic-insects-atlas.jpg', [16, 18], 'parrot'],
  ['10:61', 'avian-reproduction-b3', 'campaign', '/assets/avian-reproduction-nests-atlas.jpg', [84, 75], 'bat, not moth'],
  ['10:74', 'general-animal-life', 'title', '/assets/terrestrial-animals.jpg', [50, 48], 'animal antipathies, not ants'],
  ['11:22', 'insect-societies-b1', 'campaign', '/assets/insect-societies-lifecycles-atlas.jpg', [16, 75], 'bombyx and silkworms'],
  ['11:25', 'insect-societies-b3', 'campaign', '/assets/insect-societies-lifecycles-atlas.jpg', [84, 75], 'scorpions'],
  ['11:27', 'insect-societies-b2', 'campaign', '/assets/insect-societies-lifecycles-atlas.jpg', [50, 75], 'grasshoppers'],
  ['11:29', 'insect-societies-b2', 'campaign', '/assets/insect-societies-lifecycles-atlas.jpg', [50, 75], 'locusts'],
  ['11:30', 'insect-societies-a3', 'campaign', '/assets/insect-societies-lifecycles-atlas.jpg', [84, 25], 'ants'],
  ['11:41', 'milk-and-animal-remedies', 'campaign', '/assets/wild-plants-animal-remedies-atlas.jpg', [84, 75], 'milk and comparative anatomy'],
  ['11:48', 'comparative-anatomy-b2', 'campaign', '/assets/comparative-animal-anatomy-atlas.jpg', [50, 75], 'many-legged morphology'],
  ['13:12', 'tree-craft-a2', 'campaign', '/assets/trees-reeds-grain-craft-atlas.jpg', [50, 25], 'papyrus and paper'],
  ['17:14', 'roman-agriculture-b1', 'campaign', '/assets/roman-agriculture-gardens-atlas.jpg', [16, 75], 'grafting and pruning'],
  ['17:15', 'roman-agriculture-b1', 'campaign', '/assets/roman-agriculture-gardens-atlas.jpg', [16, 75], 'grafting the vine'],
  ['18:10', 'tree-craft-a3', 'campaign', '/assets/trees-reeds-grain-craft-atlas.jpg', [84, 25], 'fruitfulness of wheat, not fruit'],
  ['18:16', 'roman-agriculture-a3', 'campaign', '/assets/roman-agriculture-gardens-atlas.jpg', [84, 25], 'grain and legumes'],
  ['18:27', 'field-work', 'title', '/assets/crops-flowers-herbs-remedies-atlas.jpg', [55, 80], 'hay-making'],
  ['18:28', 'roman-agriculture-a1', 'campaign', '/assets/roman-agriculture-gardens-atlas.jpg', [16, 25], 'meadow cultivation'],
  ['18:29', 'agricultural-weather', 'curated', '/assets/celestial-weather-phenomena-atlas.jpg', [50, 48], 'celestial influences on crops'],
  ['18:32', 'moon', 'title', '/assets/celestial-weather-phenomena-atlas.jpg', [50, 12], 'agricultural moon'],
  ['18:33', 'winds', 'title', '/assets/celestial-weather-phenomena-atlas.jpg', [85, 49], 'agricultural winds'],
  ['21:14', 'bees-honey-and-propolis', 'campaign', '/assets/insect-societies-lifecycles-atlas.jpg', [16, 25], 'honey and bees'],
  ['23:2', 'squill-vinegar', 'curated', '/assets/aromatics-apothecary-atlas.jpg', [84, 50], 'squill vinegar and oxymel'],
  ['20:24', 'cultivated-materia-a3', 'campaign', '/assets/cultivated-materia-medica-atlas.jpg', [84, 25], 'theriaca preparation'],
  ['25:5', 'mercurialis', 'curated', '/assets/plinian-minor-herbs-atlas.jpg', [16, 18], 'linozostis and mercurialis'],
  ['25:13', 'wild-remedies-b1', 'campaign', '/assets/wild-plants-animal-remedies-atlas.jpg', [16, 75], 'anagallis and aegilops'],
  ['27:2', 'aconite', 'curated', '/assets/medicinal-herbarium-atlas.jpg', [84, 50], 'aconite'],
  ['26:4', 'roman-magic', 'curated', '/assets/human-life-belief-atlas.jpg', [62, 82], 'practices of magic'],
  ['27:7', 'aquatic-materia-b1', 'campaign', '/assets/aquatic-materia-medica-atlas.jpg', [16, 75], 'red seaweed'],
  ['27:13', 'wild-remedies-a3', 'campaign', '/assets/wild-plants-animal-remedies-atlas.jpg', [84, 25], 'toxic solanum'],
  ['26:2', 'medical-symptoms', 'title', '/assets/roman-medicine-anatomy-care-atlas.jpg', [53, 72], 'colic, not fruit'],
  ['28:8', 'elephant-remedies', 'title', '/assets/elephant-life-actions-atlas.jpg', [49, 22], 'elephant remedies'],
  ['28:20', 'wild-remedies-b3', 'campaign', '/assets/wild-plants-animal-remedies-atlas.jpg', [84, 75], 'animal-derived remedies'],
  ['29:4', 'wild-remedies-b3', 'campaign', '/assets/wild-plants-animal-remedies-atlas.jpg', [84, 75], 'dog remedies'],
  ['29:3', 'animal-derived-remedies', 'title', '/assets/creatures-papyrus-lacuna-atlas.jpg', [25, 75], 'egg remedies'],
  ['30:3', 'small-animal-remedies', 'title', '/assets/rare-terrestrial-life-atlas.jpg', [16, 50], 'mole remedies'],
  ['30:10', 'systemic-care', 'curated', '/assets/human-life-belief-atlas.jpg', [84, 82], 'whole-body care'],
  ['30:16', 'wild-remedies-b3', 'campaign', '/assets/wild-plants-animal-remedies-atlas.jpg', [84, 75], 'animal-derived marvels'],
  ['31:2', 'aquatic-materia-b2', 'campaign', '/assets/aquatic-materia-medica-atlas.jpg', [50, 75], 'waters'],
  ['31:6', 'aquatic-materia-b2', 'campaign', '/assets/aquatic-materia-medica-atlas.jpg', [50, 75], 'aqueducts'],
  ['31:7', 'aquatic-materia-b2', 'campaign', '/assets/aquatic-materia-medica-atlas.jpg', [50, 75], 'salt pans'],
  ['31:10', 'aquatic-materia-b2', 'campaign', '/assets/aquatic-materia-medica-atlas.jpg', [50, 75], 'nitrum'],
  ['31:11', 'aquatic-materia-a1', 'campaign', '/assets/aquatic-materia-medica-atlas.jpg', [16, 25], 'sponges'],
  ['32:4', 'tortoises', 'title', '/assets/terrestrial-animals.jpg', [29, 81], 'tortoise'],
  ['35:6', 'pigments', 'title', '/assets/mineral-fire-lacuna-atlas.jpg', [84, 75], 'non-metallic pigments'],
  ['35:18', 'freedmen-status', 'curated', '/assets/human-life-belief-atlas.jpg', [62, 50], 'freedmen and social rank'],
  ['35:19', 'mineral-substances', 'title', '/assets/mineral-fire-lacuna-atlas.jpg', [50, 25], 'regional mineral earths'],
  ['36:13', 'roman-metals-arts-b2', 'campaign', '/assets/roman-metals-arts-stones-atlas.jpg', [50, 75], 'labyrinths'],
  ['36:25', 'architecture', 'title', '/assets/minerals-metals-arts-atlas-v2.jpg', [87, 76], 'pavements and mosaics'],
  ['37:4', 'gems', 'title', '/assets/minerals-metals-arts-atlas-v2.jpg', [20, 70], 'adamas'],
  ['37:5', 'roman-metals-arts-b3', 'campaign', '/assets/roman-metals-arts-stones-atlas.jpg', [84, 75], 'smaragdus'],
  ['37:8', 'gems', 'title', '/assets/minerals-metals-arts-atlas-v2.jpg', [20, 70], 'topazos'],
];

for (const [key, , , , , label] of semanticFixtures) {
  const illustration = illustrations.get(key);
  if (!illustration) throw new Error(`Missing semantic fixture for ${label}`);
  const assignment = certifiedArtworkManifest.assignments?.[key];
  if (assignment?.kind === 'chapter-scene') {
    if (illustration.matchSource !== 'chapter-scene'
      || illustration.images[0] !== CHAPTER_SCENE_SOURCES[key]?.logicalPath
      || illustration.panelCount !== 1) {
      throw new Error(`Invalid one-to-one chapter illustration for ${label}`);
    }
    continue;
  }
  if (assignment?.kind === 'atlas-cell') {
    const assignedImage = `/assets/${path.basename(assignment.sourceArtifact)}`;
    if (illustration.matchSource !== 'certified-atlas-cell'
      || illustration.images[0] !== assignedImage
      || illustration.mainCell !== assignment.cell
      || illustration.panelCount !== 1
      || illustration.panels[0]?.source.viewerKind !== 'cell') {
      throw new Error(`Invalid certified atlas-cell illustration for ${label}`);
    }
    continue;
  }
  throw new Error(`Semantic fixture ${key} has no certified assignment`);
}

const captionFixtures = [
  ['2:87', 'NEW ISLANDS FORMED'],
  ['2:88', 'LANDS SEVERED BY THE SEA'],
  ['2:89', 'ISLANDS JOINED TO THE MAINLAND'],
  ['2:90', 'LANDS CHANGED INTO SEAS'],
  ['2:91', 'LANDS SWALLOWED UP'],
  ['9:45', 'SEA-NETTLE & PLANT-LIKE MARINE LIFE'],
  ['25:5', 'LINOZOSTIS & MERCURIALIS'],
  ['25:13', 'MINOR MEDICINAL HERBS'],
];

for (const [key] of captionFixtures) {
  const illustration = illustrations.get(key);
  const assignment = certifiedArtworkManifest.assignments?.[key];
  const captionMatchesAssignment = assignment?.kind === 'chapter-scene'
    ? illustration?.englishCaption.includes('EDITORIAL PLATE')
    : assignment?.kind === 'atlas-cell'
      ? illustration?.englishCaption.includes('CERTIFIED STUDY')
      : false;
  if (!captionMatchesAssignment) {
    throw new Error(`Wrong plate caption at ${key}: ${illustration?.englishCaption ?? 'missing'}`);
  }
}

const declaredContinuity = new Map();
for (const record of routeRecords) {
  const group = record.illustration.continuityGroup;
  if (!group) continue;
  if (!declaredContinuity.has(group)) declaredContinuity.set(group, []);
  declaredContinuity.get(group).push(record);
}
for (const [group, records] of declaredContinuity) {
  if (records.length < 2) throw new Error(`Continuity group ${group} has fewer than two leaves`);
  const signatures = new Set(records.map((record) => `${record.illustration.images[0]}|${record.illustration.subject}`));
  if (signatures.size !== 1) throw new Error(`Declared continuity group ${group} has drifted`);
}

console.log(
  `Verified ${instances.size.toLocaleString('en-US')} chapter instances, ${studies.size} route-free main studies, ${panels.size} panel compositions, ${renderedCompositions.size} exact rendered compositions, ${usedImages.size} primary assets, ${deployedPlateFiles.length} responsive derivatives (${(deployedPlateBytes / 1024 / 1024).toFixed(2)} MiB), ${campaignCellUrls.size} unique fullscreen cell URLs, ${generatedMainCells.size}/${declaredGeneratedCells.length} receipt-backed atlas cells represented as primary studies, ${originalChapterRoutes} one-to-one original chapter scenes, ${certifiedAtlasRoutes} certified atlas-cell overrides, ${subjects.size} subjects, ${layouts.size} layout grammars, ${curatedRoutes} hand-curated routes, ${campaignRoutes} taxonomy-mapped campaign routes, ${titleMatches} heading-grounded routes, ${subheadingMatches} subheading-grounded routes, and ${fallbackRoutes} broad fallbacks across ${families.size} visual families`,
);
