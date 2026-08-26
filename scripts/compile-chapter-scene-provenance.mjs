import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const campaignRoot = path.join(root, 'assets-source', 'chapter-scenes-v1');
const rightsPath = path.join(root, 'assets-source', 'asset-rights.json');

function toolArtifactId(outputArtifact) {
  const match = path.basename(String(outputArtifact ?? '')).match(/^(exec-[a-f0-9-]+)\.png$/i);
  return match?.[1] ?? null;
}

function publicArtifactReference(outputArtifact) {
  const artifactId = toolArtifactId(outputArtifact);
  return artifactId ? `built-in-imagegen://${artifactId}.png` : null;
}

function sanitizePublicText(value) {
  return String(value ?? '').replace(
    /\/Users\/[^/\s]+\/\.codex\/generated_images\/[^/\s]+\/(exec-[a-f0-9-]+\.png)/gi,
    'built-in-imagegen://$1',
  );
}

const directories = (await readdir(campaignRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const records = {};
const sourceHashes = new Set();
const evidenceIds = new Set();
const generationDates = [];

for (const directory of directories) {
  const receiptPath = path.join(campaignRoot, directory, 'receipt.json');
  let receipt;
  try {
    receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') continue;
    throw error;
  }
  if (receipt.schemaVersion !== 1 || !Array.isArray(receipt.chapters)) {
    throw new Error(`${receiptPath} has an unsupported receipt schema.`);
  }
  for (const chapter of receipt.chapters) {
    const chapterKey = chapter.chapterKey;
    if (!/^\d+:(?:praef|\d+)$/.test(chapterKey) || records[chapterKey]) {
      throw new Error(`${receiptPath} repeats or misidentifies chapter ${chapterKey}.`);
    }
    const sourceArtifact = chapter.projectArtifact
      ?? (String(chapter.sourceArtifact).startsWith('assets-source/') ? chapter.sourceArtifact : null);
    const prompt = chapter.finalPrompt ?? chapter.exactFinalPrompt;
    const privateOutputArtifact = chapter.outputArtifact
      ?? (String(chapter.sourceArtifact).startsWith('/') ? chapter.sourceArtifact : null);
    const originalArtifact = publicArtifactReference(privateOutputArtifact);
    const generationArtifactId = toolArtifactId(privateOutputArtifact);
    const receiptId = chapter.receiptId ?? receipt.toolReceiptId ?? null;
    const evidenceId = receiptId ?? generationArtifactId;
    const builtInMode = chapter.builtInMode ?? receipt.builtInMode;
    const generatedAt = chapter.generatedAt ?? receipt.generatedAt ?? '2026-08-24';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(generatedAt)) {
      throw new Error(`${chapterKey} has an invalid generation date ${generatedAt}.`);
    }
    if (!sourceArtifact || !prompt || builtInMode !== true || !originalArtifact || !evidenceId) {
      throw new Error(`${chapterKey} lacks its project artifact, exact prompt, built-in output artifact, or evidence ID.`);
    }
    if (evidenceIds.has(evidenceId)) throw new Error(`${chapterKey} reuses generation evidence ${evidenceId}.`);
    evidenceIds.add(evidenceId);

    const sourcePath = path.join(root, sourceArtifact);
    const bytes = await readFile(sourcePath);
    const sourceSha256 = createHash('sha256').update(bytes).digest('hex');
    if (chapter.sha256 && chapter.sha256 !== sourceSha256) throw new Error(`${chapterKey} receipt hash drifted.`);
    if (sourceHashes.has(sourceSha256)) throw new Error(`${chapterKey} is byte-identical to another generated scene.`);
    sourceHashes.add(sourceSha256);
    if ((await stat(sourcePath)).size < 100_000) throw new Error(`${chapterKey} source artifact is implausibly small.`);

    const notes = (Array.isArray(chapter.visualQaNotes)
      ? chapter.visualQaNotes
      : [chapter.visualQaNotes].filter(Boolean))
      .map(sanitizePublicText);
    if (!notes.length) throw new Error(`${chapterKey} lacks visual QA notes.`);
    records[chapterKey] = {
      chapterKey,
      title: chapter.title,
      generatedAt,
      sourceArtifact,
      sourceSha256,
      prompt,
      builtInMode: true,
      tool: chapter.tool ?? receipt.tool ?? 'OpenAI built-in image_gen',
      receiptId,
      generationArtifactId,
      originalArtifact,
      visualQa: { status: 'passed', notes },
      campaignWave: receipt.campaign ?? directory,
    };
    generationDates.push(generatedAt);
  }
}

generationDates.sort();
const generatedThrough = generationDates.at(-1) ?? '2026-08-24';

const provenance = {
  schemaVersion: 1,
  campaign: 'naturalis-chapter-scenes-v1',
  generatedAt: generatedThrough,
  tool: 'OpenAI built-in image_gen',
  creator: 'OpenAI ImageGen, directed by the project owner and Codex',
  evidencePolicy: 'The built-in tool did not expose a separate receipt field. Each scene is therefore bound to the unique exec-prefixed output artifact returned by the tool, the exact prompt, the copied source SHA-256, and visual-QA notes. A null receiptId is preserved rather than fabricated.',
  records: Object.fromEntries(Object.entries(records).sort(([left], [right]) => left.localeCompare(right, 'en', { numeric: true }))),
};
await writeFile(
  path.join(root, 'assets-source', 'chapter-scenes-provenance.json'),
  `${JSON.stringify(provenance, null, 2)}\n`,
);

const rights = JSON.parse(await readFile(rightsPath, 'utf8'));
for (const logicalId of Object.keys(rights.assets ?? {})) {
  if (logicalId.startsWith('chapter-scene:')) delete rights.assets[logicalId];
}
for (const [chapterKey, record] of Object.entries(provenance.records)) {
  rights.assets[`chapter-scene:${chapterKey}`] = {
    sourceArtifact: record.sourceArtifact,
    sourceSha256: record.sourceSha256,
    rightsStatus: 'cleared-owner-directed-original-output',
    rightsHolder: 'Naturalis Historia project owner (elder-plinius)',
    license: 'AGPL-3.0-only',
    evidence: 'Owner AGPL-3.0 licensing instruction dated 2026-08-24 plus the source-bound built-in ImageGen output artifact, exact prompt, SHA-256, and visual-QA record.',
    provenanceReference: 'assets-source/chapter-scenes-provenance.json',
  };
}
await writeFile(rightsPath, `${JSON.stringify(rights, null, 2)}\n`);

console.log(`Compiled ${Object.keys(records).length} unique full-scene generation records and source-bound AGPL-3.0 rights entries.`);
