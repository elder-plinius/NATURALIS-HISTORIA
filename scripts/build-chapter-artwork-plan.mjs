import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chapterIllustration } from '../app/illustrations.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpusRoot = path.join(root, 'public', 'corpus');
const manifest = JSON.parse(await readFile(path.join(corpusRoot, 'manifest.json'), 'utf8'));
const atlasCampaign = JSON.parse(await readFile(path.join(root, 'assets-source', 'plates-provenance.json'), 'utf8'));
let chapterSceneCampaign = { records: {} };
try {
  chapterSceneCampaign = JSON.parse(await readFile(path.join(root, 'assets-source', 'chapter-scenes-provenance.json'), 'utf8'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
if (!chapterSceneCampaign.records) throw new Error('Chapter-scene provenance record is invalid.');

const HOUSE_STYLE = 'Original Plinian natural-history folio on warm aged vellum; iron-gall linework, fine cross-hatching and stipple; restrained umber, lampblack, verdigris, faded lapis, madder and ochre mineral pigments; ancient, timeless, beautiful, rough and polished at once; complete subjects with breathing room. Preserve those material constants across the edition while allowing book-family dialects in composition, pigment emphasis, scale and atmosphere. No text, labels, pseudo-writing, signatures, logos, watermarks, modern objects, photography or glossy digital rendering.';

const campaigns = [
  { id: 'cosmos-geography-animals', books: [1, 11] },
  { id: 'trees-agriculture-materia', books: [12, 27] },
  { id: 'medicine-minerals-arts', books: [28, 37] },
];

function campaignFor(bookNumber) {
  const campaign = campaigns.find(({ books: [first, last] }) => bookNumber >= first && bookNumber <= last);
  if (!campaign) throw new Error(`No production campaign owns Book ${bookNumber}`);
  return campaign.id;
}

function normalizedExcerpt(text, limit = 360) {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) return normalized;
  const clipped = normalized.slice(0, limit);
  return `${clipped.slice(0, Math.max(clipped.lastIndexOf(' '), limit - 40)).trim()}…`;
}

function sceneStem(bookNumber, chapterId) {
  const normalizedChapter = chapterId === 'praef'
    ? 'praef'
    : `c${String(chapterId).padStart(3, '0')}`;
  return `b${String(bookNumber).padStart(2, '0')}-${normalizedChapter}`;
}

const atlasAssets = new Set(Object.keys(atlasCampaign.assets ?? {}));
const atlasCellInventory = Object.entries(atlasCampaign.assets ?? {}).flatMap(([atlasFile, receipt]) =>
  Object.entries(receipt.cells ?? {}).map(([cell, label]) => ({
    id: `${atlasFile}#${cell}`,
    atlasFile,
    cell,
    label,
  })));
const atlasCellInventoryById = new Map();
for (const atlasCell of atlasCellInventory) {
  if (atlasCellInventoryById.has(atlasCell.id)) {
    throw new Error(`Duplicate receipt-backed atlas cell in inventory: ${atlasCell.id}`);
  }
  atlasCellInventoryById.set(atlasCell.id, atlasCell);
}
const reservedAtlasCells = new Set();
const certifiedAssignments = {};
const chapters = {};
const pendingByCampaign = new Map(campaigns.map(({ id }) => [id, []]));
let ordinal = 0;

for (const bookMeta of manifest.books) {
  const book = JSON.parse(await readFile(path.join(root, 'public', bookMeta.file.replace(/^\//, '')), 'utf8'));
  for (const chapter of book.chapters) {
    const chapterKey = `${book.number}:${chapter.id}`;
    const campaignId = campaignFor(book.number);
    const illustration = chapterIllustration({
      bookNumber: book.number,
      bookRoman: book.roman,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      chapterLatinTitle: chapter.latinTitle,
      englishSubheadings: chapter.englishChapters,
      ordinal,
      // The plan emits the runtime override module, so its inventory pass must
      // be independent of whatever override a previous plan run generated.
      ignoreCertifiedAtlasOverride: true,
    });
    const atlasFile = path.basename(illustration.images[0]);
    const atlasCellId = illustration.mainCell && atlasAssets.has(atlasFile)
      ? `${atlasFile}#${illustration.mainCell}`
      : null;
    const chapterScene = chapterSceneCampaign.records[chapterKey] ?? null;
    const existingArtworkId = !chapterScene && atlasCellId && !reservedAtlasCells.has(atlasCellId)
      ? `atlas-cell:${atlasCellId}`
      : null;
    const title = chapter.title || chapter.label || `Book ${book.roman}, ${chapter.id}`;
    const sourceExcerpt = normalizedExcerpt(chapter.english);
    const stem = sceneStem(book.number, chapter.id);
    const plannedSourceArtifact = `assets-source/chapter-scenes-v1/${campaignId}/${stem}.png`;
    const record = {
      chapterKey,
      bookNumber: book.number,
      bookRoman: book.roman,
      chapterId: chapter.id,
      title,
      campaign: campaignId,
      status: chapterScene ? 'generated-full-scene' : existingArtworkId ? 'receipt-backed-atlas-cell' : 'planned-full-scene',
      artworkId: chapterScene ? `chapter-scene:${chapterKey}` : existingArtworkId,
      plannedArtworkId: `chapter-scene:${chapterKey}`,
      plannedSourceArtifact,
      sceneBrief: `Book ${book.roman}, chapter ${chapter.id}: ${title}. Ground the composition in this chapter opening: ${sourceExcerpt}`,
      generationContract: {
        useCase: 'historical-scene',
        mode: 'OpenAI built-in image_gen',
        oneCallPerArtwork: true,
        aspect: 'landscape 3:2',
        houseStyle: HOUSE_STYLE,
      },
    };

    if (chapterScene) {
      record.sourceArtifact = chapterScene.sourceArtifact;
      record.sourceSha256 = chapterScene.sourceSha256;
      record.generationArtifactId = chapterScene.generationArtifactId;
      certifiedAssignments[chapterKey] = {
        artworkId: `chapter-scene:${chapterKey}`,
        kind: 'chapter-scene',
        sourceArtifact: chapterScene.sourceArtifact,
        sourceSha256: chapterScene.sourceSha256,
        generationArtifactId: chapterScene.generationArtifactId,
        title,
      };
    } else if (existingArtworkId) {
      reservedAtlasCells.add(atlasCellId);
      record.sourceArtifact = `assets-source/plates/${atlasFile}`;
      record.cell = illustration.mainCell;
      record.cellLabel = atlasCampaign.assets[atlasFile].cells[record.cell];
      certifiedAssignments[chapterKey] = {
        artworkId: existingArtworkId,
        kind: 'atlas-cell',
        sourceArtifact: record.sourceArtifact,
        cell: record.cell,
        cellLabel: record.cellLabel,
        title,
      };
    } else {
      pendingByCampaign.get(campaignId).push(chapterKey);
    }
    chapters[chapterKey] = record;
    ordinal += 1;
  }
}

if (ordinal !== manifest.totalChapters) {
  throw new Error(`Planned ${ordinal} chapters; corpus declares ${manifest.totalChapters}`);
}

const unknownChapterSceneKeys = Object.keys(chapterSceneCampaign.records)
  .filter((chapterKey) => !Object.hasOwn(chapters, chapterKey));
if (unknownChapterSceneKeys.length > 0) {
  throw new Error(`Chapter-scene provenance contains keys outside the corpus: ${unknownChapterSceneKeys.join(', ')}`);
}

for (const [campaignId, chapterKeys] of pendingByCampaign) {
  chapterKeys.forEach((chapterKey, index) => {
    chapters[chapterKey].batchId = `${campaignId}-${String(Math.floor(index / 4) + 1).padStart(3, '0')}`;
    chapters[chapterKey].batchPosition = (index % 4) + 1;
  });
}

// A full chapter scene may supersede a chapter's former atlas assignment. The
// released cell remains valid source art, but must not be force-routed to an
// unrelated chapter merely to keep every atlas cell in use.
const unusedAtlasCells = atlasCellInventory
  .filter(({ id }) => !reservedAtlasCells.has(id))
  .map(({ id, atlasFile, cell, label }) => ({
    artworkId: `atlas-cell:${id}`,
    sourceArtifact: `assets-source/plates/${atlasFile}`,
    cell,
    cellLabel: label,
    status: 'available-unused',
  }));
const assignmentEntries = Object.entries(certifiedAssignments);
const generatedFullSceneCount = assignmentEntries.filter(([, assignment]) => assignment.kind === 'chapter-scene').length;
const assignedAtlasCellCount = assignmentEntries.filter(([, assignment]) => assignment.kind === 'atlas-cell').length;
const pendingFullSceneCount = [...pendingByCampaign.values()].reduce((sum, chapterKeys) => sum + chapterKeys.length, 0);
const assignmentArtworkIds = assignmentEntries.map(([, assignment]) => assignment.artworkId);
const assignmentSourceIds = assignmentEntries.map(([, assignment]) => assignment.kind === 'atlas-cell'
  ? `${assignment.sourceArtifact}#${assignment.cell}`
  : assignment.sourceArtifact);

if (assignmentEntries.some(([, assignment]) => Object.hasOwn(assignment, 'allocationReason'))) {
  throw new Error('Semantic rehome metadata is forbidden; unused atlas cells must remain available-unused');
}
if (new Set(assignmentArtworkIds).size !== assignmentArtworkIds.length) {
  throw new Error('Certified artwork IDs are not one-to-one');
}
if (new Set(assignmentSourceIds).size !== assignmentSourceIds.length) {
  throw new Error('Certified source artworks are not one-to-one');
}
if (assignedAtlasCellCount !== reservedAtlasCells.size) {
  throw new Error(`Reserved ${reservedAtlasCells.size} atlas cells but emitted ${assignedAtlasCellCount} assignments`);
}
if (reservedAtlasCells.size + unusedAtlasCells.length !== atlasCellInventory.length) {
  throw new Error('Assigned and available-unused atlas cells do not partition the receipt-backed inventory');
}
if (generatedFullSceneCount !== Object.keys(chapterSceneCampaign.records).length) {
  throw new Error(`Assigned ${generatedFullSceneCount} chapter scenes from ${Object.keys(chapterSceneCampaign.records).length} provenance records`);
}
if (assignmentEntries.length + pendingFullSceneCount !== ordinal) {
  throw new Error(`Certified ${assignmentEntries.length} assignments with ${pendingFullSceneCount} pending; expected ${ordinal} chapters total`);
}

const plan = {
  schemaVersion: 1,
  generatedAt: chapterSceneCampaign.generatedAt ?? '2026-08-24',
  corpusRevision: manifest.revision,
  targetArtworkCount: manifest.totalChapters,
  productionPolicy: 'Exactly one independently generated, full-resolution source artwork per chapter. Atlas cells remain valid only when receipt-backed, source-hash-bound, visually independent, and assigned to one chapter exactly once. Crops, reframings, responsive derivatives and panel variations never increase the source-art count.',
  houseStyle: HOUSE_STYLE,
  counts: {
    chapters: ordinal,
    generatedFullScenes: generatedFullSceneCount,
    receiptBackedAtlasCellsAvailable: atlasCellInventory.length,
    receiptBackedAtlasCellsAssigned: assignedAtlasCellCount,
    receiptBackedAtlasCellsUnused: unusedAtlasCells.length,
    certifiedOneToOneAssignments: assignmentEntries.length,
    plannedFullScenes: pendingFullSceneCount,
  },
  atlasCellInventory: {
    sourceArtifact: 'assets-source/plates-provenance.json',
    policy: 'Receipt-backed atlas cells superseded by chapter scenes remain certified and available, but unused. They are never force-routed to semantically unrelated chapters.',
    availableCount: atlasCellInventory.length,
    assignedCount: assignedAtlasCellCount,
    unusedCount: unusedAtlasCells.length,
    unusedCells: unusedAtlasCells,
  },
  campaigns: Object.fromEntries(campaigns.map(({ id, books }) => [id, {
    books,
    pendingChapterCount: pendingByCampaign.get(id).length,
    batchSize: 4,
    batchCount: Math.ceil(pendingByCampaign.get(id).length / 4),
  }])),
  chapters,
};

const planText = `${JSON.stringify(plan, null, 2)}\n`;
const planSha256 = createHash('sha256').update(planText).digest('hex');
const certifiedManifest = {
  schemaVersion: 1,
  generatedAt: plan.generatedAt,
  corpusRevision: manifest.revision,
  targetArtworkCount: manifest.totalChapters,
  plan: {
    file: 'assets-source/chapter-artwork-plan.json',
    sha256: planSha256,
  },
  counts: plan.counts,
  atlasCellInventory: plan.atlasCellInventory,
  assignments: certifiedAssignments,
};
const certifiedAtlasOverrides = Object.fromEntries(Object.entries(certifiedAssignments)
  .filter(([, assignment]) => assignment.kind === 'atlas-cell')
  .map(([chapterKey, assignment]) => [chapterKey, {
    artworkId: assignment.artworkId,
    logicalPath: `/assets/${path.basename(assignment.sourceArtifact)}`,
    cell: assignment.cell,
    cellLabel: assignment.cellLabel,
  }]));
const runtimeOverridesModule = `// Generated by scripts/build-chapter-artwork-plan.mjs. Do not edit by hand.\n`
  + `export const CERTIFIED_ATLAS_OVERRIDES = Object.freeze(${JSON.stringify(certifiedAtlasOverrides, null, 2)});\n\n`
  + `export function certifiedAtlasOverrideFor(bookNumber, chapterId) {\n`
  + `  return CERTIFIED_ATLAS_OVERRIDES[\`${'${bookNumber}:${chapterId}'}\`] ?? null;\n`
  + `}\n`;

await writeFile(path.join(root, 'assets-source', 'chapter-artwork-plan.json'), planText);
await writeFile(
  path.join(root, 'assets-source', 'chapter-artwork-manifest.json'),
  `${JSON.stringify(certifiedManifest, null, 2)}\n`,
);
await writeFile(path.join(root, 'app', 'generated-certified-artwork-overrides.mjs'), runtimeOverridesModule);

console.log(
  `Planned ${ordinal.toLocaleString('en-US')} one-to-one chapter artworks: `
  + `${generatedFullSceneCount} generated full scenes and `
  + `${assignedAtlasCellCount}/${atlasCellInventory.length} receipt-backed atlas cells assigned once; `
  + `${unusedAtlasCells.length} atlas cells remain available-unused; `
  + `${pendingFullSceneCount} independent full scenes queued in `
  + `${Object.values(plan.campaigns).reduce((sum, campaign) => sum + campaign.batchCount, 0)} four-scene batches.`,
);
