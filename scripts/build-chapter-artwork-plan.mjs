import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpusRoot = path.join(root, 'public', 'corpus');
const manifest = JSON.parse(await readFile(path.join(corpusRoot, 'manifest.json'), 'utf8'));
const chapterSceneCampaign = JSON.parse(
  await readFile(path.join(root, 'assets-source', 'chapter-scenes-provenance.json'), 'utf8'),
);

const EXPECTED_CHAPTER_SCENES = 1_065;
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

if (manifest.totalChapters !== EXPECTED_CHAPTER_SCENES) {
  throw new Error(`Canonical corpus size drifted: expected ${EXPECTED_CHAPTER_SCENES}, found ${manifest.totalChapters}`);
}
if (!chapterSceneCampaign.records || typeof chapterSceneCampaign.records !== 'object') {
  throw new Error('Chapter-scene provenance record is invalid.');
}

const chapters = {};
const certifiedAssignments = {};
const corpusKeys = new Set();
let ordinal = 0;

for (const bookMeta of manifest.books) {
  const book = JSON.parse(await readFile(path.join(root, 'public', bookMeta.file.replace(/^\//, '')), 'utf8'));
  for (const chapter of book.chapters) {
    const chapterKey = `${book.number}:${chapter.id}`;
    const chapterScene = chapterSceneCampaign.records[chapterKey];
    if (!chapterScene) {
      throw new Error(`Missing standalone chapter-scene provenance for ${chapterKey}`);
    }
    if (chapterScene.chapterKey !== chapterKey) {
      throw new Error(`Chapter-scene provenance key drifted at ${chapterKey}`);
    }
    if (!chapterScene.sourceArtifact
      || !chapterScene.sourceSha256
      || !chapterScene.generationArtifactId) {
      throw new Error(`Chapter-scene provenance is incomplete at ${chapterKey}`);
    }

    const campaignId = campaignFor(book.number);
    const title = chapter.title || chapter.label || `Book ${book.roman}, ${chapter.id}`;
    const plannedArtworkId = `chapter-scene:${chapterKey}`;
    const plannedSourceArtifact = `assets-source/chapter-scenes-v1/${campaignId}/${sceneStem(book.number, chapter.id)}.png`;

    chapters[chapterKey] = {
      chapterKey,
      bookNumber: book.number,
      bookRoman: book.roman,
      chapterId: chapter.id,
      title,
      campaign: campaignId,
      status: 'generated-full-scene',
      artworkId: plannedArtworkId,
      plannedArtworkId,
      plannedSourceArtifact,
      sceneBrief: `Book ${book.roman}, chapter ${chapter.id}: ${title}. Ground the composition in this chapter opening: ${normalizedExcerpt(chapter.english)}`,
      generationContract: {
        useCase: 'historical-scene',
        mode: 'OpenAI built-in image_gen',
        oneCallPerArtwork: true,
        aspect: 'landscape 3:2',
        houseStyle: HOUSE_STYLE,
      },
      sourceArtifact: chapterScene.sourceArtifact,
      sourceSha256: chapterScene.sourceSha256,
      generationArtifactId: chapterScene.generationArtifactId,
    };
    certifiedAssignments[chapterKey] = {
      artworkId: plannedArtworkId,
      kind: 'chapter-scene',
      sourceArtifact: chapterScene.sourceArtifact,
      sourceSha256: chapterScene.sourceSha256,
      generationArtifactId: chapterScene.generationArtifactId,
      title,
    };
    corpusKeys.add(chapterKey);
    ordinal += 1;
  }
}

if (ordinal !== EXPECTED_CHAPTER_SCENES) {
  throw new Error(`Planned ${ordinal} chapters; expected ${EXPECTED_CHAPTER_SCENES}`);
}

const provenanceEntries = Object.entries(chapterSceneCampaign.records);
const unknownChapterSceneKeys = provenanceEntries
  .map(([chapterKey]) => chapterKey)
  .filter((chapterKey) => !corpusKeys.has(chapterKey));
if (unknownChapterSceneKeys.length > 0) {
  throw new Error(`Chapter-scene provenance contains keys outside the corpus: ${unknownChapterSceneKeys.join(', ')}`);
}
if (provenanceEntries.length !== EXPECTED_CHAPTER_SCENES) {
  throw new Error(`Expected ${EXPECTED_CHAPTER_SCENES} chapter-scene records; found ${provenanceEntries.length}`);
}

const assignmentEntries = Object.entries(certifiedAssignments);
for (const field of ['artworkId', 'sourceArtifact', 'sourceSha256', 'generationArtifactId']) {
  const values = assignmentEntries.map(([, assignment]) => assignment[field]);
  if (new Set(values).size !== EXPECTED_CHAPTER_SCENES) {
    throw new Error(`Standalone chapter scenes are not one-to-one by ${field}`);
  }
}

const counts = {
  chapters: EXPECTED_CHAPTER_SCENES,
  generatedFullScenes: EXPECTED_CHAPTER_SCENES,
  receiptBackedAtlasCellsAvailable: 0,
  receiptBackedAtlasCellsAssigned: 0,
  receiptBackedAtlasCellsUnused: 0,
  certifiedOneToOneAssignments: EXPECTED_CHAPTER_SCENES,
  plannedFullScenes: 0,
};
const plan = {
  schemaVersion: 1,
  generatedAt: chapterSceneCampaign.generatedAt ?? '2026-08-26',
  corpusRevision: manifest.revision,
  targetArtworkCount: EXPECTED_CHAPTER_SCENES,
  productionPolicy: 'Exactly one independently generated, full-resolution standalone source artwork per chapter. Chapter routes do not use atlas cells, crops, fallbacks, reframings or panel variations as source artwork.',
  houseStyle: HOUSE_STYLE,
  counts,
  campaigns: Object.fromEntries(campaigns.map(({ id, books }) => [id, {
    books,
    pendingChapterCount: 0,
    batchSize: 4,
    batchCount: 0,
  }])),
  chapters,
};

const planText = `${JSON.stringify(plan, null, 2)}\n`;
const planSha256 = createHash('sha256').update(planText).digest('hex');
const certifiedManifest = {
  schemaVersion: 1,
  generatedAt: plan.generatedAt,
  corpusRevision: manifest.revision,
  targetArtworkCount: EXPECTED_CHAPTER_SCENES,
  plan: {
    file: 'assets-source/chapter-artwork-plan.json',
    sha256: planSha256,
  },
  counts,
  assignments: certifiedAssignments,
};

await writeFile(path.join(root, 'assets-source', 'chapter-artwork-plan.json'), planText);
await writeFile(
  path.join(root, 'assets-source', 'chapter-artwork-manifest.json'),
  `${JSON.stringify(certifiedManifest, null, 2)}\n`,
);

console.log(`Planned ${EXPECTED_CHAPTER_SCENES.toLocaleString('en-US')} independently generated chapter scenes; no atlas inventory, assignments, fallbacks or pending work remain.`);
