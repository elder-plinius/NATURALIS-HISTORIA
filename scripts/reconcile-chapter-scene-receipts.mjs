import { createHash } from 'node:crypto';
import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const campaignRoot = path.join(root, 'assets-source', 'chapter-scenes-v1');
const privateArtifactPattern = /\/Users\/[^/\s]+\/\.codex\/generated_images\/[^/\s]+\/(exec-[a-f0-9-]+\.png)/gi;
const portableArtifactPattern = /^built-in-imagegen:\/\/(exec-[a-f0-9-]+)\.png$/i;

function sanitize(value) {
  if (typeof value === 'string') {
    return value.replace(privateArtifactPattern, 'built-in-imagegen://$1');
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sanitize(child)]));
  }
  return value;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const directories = (await readdir(campaignRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
let mergedRepairs = 0;
let sanitizedReceipts = 0;

for (const directory of directories) {
  const waveRoot = path.join(campaignRoot, directory);
  const receiptPath = path.join(waveRoot, 'receipt.json');
  try {
    await access(receiptPath);
  } catch {
    continue;
  }

  const rawReceipt = await readFile(receiptPath, 'utf8');
  const receipt = sanitize(JSON.parse(rawReceipt));
  if (!Array.isArray(receipt.chapters)) throw new Error(`${receiptPath} has no chapter array.`);
  const evidenceRoot = path.join(waveRoot, 'evidence');
  let evidenceFiles = [];
  try {
    evidenceFiles = (await readdir(evidenceRoot))
      .filter((file) => /^b\d+-c\d+-repair\.json$/i.test(file))
      .sort();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  for (const evidenceFile of evidenceFiles) {
    const evidencePath = path.join(evidenceRoot, evidenceFile);
    const repair = sanitize(JSON.parse(await readFile(evidencePath, 'utf8')));
    const chapter = receipt.chapters.find((candidate) => candidate.chapterKey === repair.chapterKey);
    if (!chapter) throw new Error(`${evidencePath} targets missing chapter ${repair.chapterKey}.`);
    const artifactMatch = String(repair.sourceArtifact ?? '').match(portableArtifactPattern);
    if (!artifactMatch || artifactMatch[1] !== repair.acceptedArtifactId) {
      throw new Error(`${evidencePath} lacks a matching portable built-in artifact reference.`);
    }
    if (chapter.sourceArtifact !== repair.projectArtifact && chapter.projectArtifact !== repair.projectArtifact) {
      throw new Error(`${evidencePath} does not match the receipt project artifact.`);
    }
    const acceptedSha256 = repair.sha256 ?? repair.acceptedOutputSha256 ?? repair.projectArtifactSha256;
    const declaredAcceptedHashes = [repair.sha256, repair.acceptedOutputSha256, repair.projectArtifactSha256]
      .filter(Boolean);
    if (!acceptedSha256 || declaredAcceptedHashes.some((value) => value !== acceptedSha256)) {
      throw new Error(`${evidencePath} has inconsistent accepted hashes.`);
    }
    const visualQaNotes = Array.isArray(repair.visualQaNotes)
      ? repair.visualQaNotes
      : [repair.visualQaNotes].filter(Boolean);
    const canonicalBytes = await readFile(path.join(root, repair.projectArtifact));
    if (sha256(canonicalBytes) !== acceptedSha256) {
      throw new Error(`${evidencePath} does not match the canonical source bytes.`);
    }
    if (!repair.exactFinalPrompt || !visualQaNotes.length) {
      throw new Error(`${evidencePath} lacks its exact prompt or visual QA notes.`);
    }
    const rejectedRecords = [
      ...(repair.rejectedArtifacts ?? repair.rejectedAttempts ?? []),
      ...[repair.preexistingRejectedCanonical].filter(Boolean),
    ].map((rejected) => ({
      outputArtifact: rejected.evidenceArtifact ?? rejected.sourceArtifact ?? rejected.path,
      sha256: rejected.sha256,
      reason: rejected.reason,
    }));
    for (const rejected of rejectedRecords) {
      if (!rejected.outputArtifact || !rejected.sha256 || !rejected.reason) {
        throw new Error(`${evidencePath} has an incomplete rejected-attempt record.`);
      }
      if (String(rejected.outputArtifact).startsWith('assets-source/')) {
        const rejectedBytes = await readFile(path.join(root, rejected.outputArtifact));
        if (sha256(rejectedBytes) !== rejected.sha256) {
          throw new Error(`${evidencePath} has drifted rejected evidence ${rejected.outputArtifact}.`);
        }
      }
    }

    chapter.sha256 = acceptedSha256;
    chapter.outputArtifact = repair.sourceArtifact;
    chapter.generationArtifactId = repair.acceptedArtifactId;
    chapter.exactFinalPrompt = repair.exactFinalPrompt;
    chapter.promptAssembly = repair.promptAssembly;
    chapter.visualQaNotes = visualQaNotes;
    chapter.repairEvidence = path.relative(root, evidencePath);
    chapter.rejectedAttempts = rejectedRecords;
    mergedRepairs += 1;
  }

  const reconciled = `${JSON.stringify(receipt, null, 2)}\n`;
  if (reconciled !== rawReceipt) {
    await writeFile(receiptPath, reconciled);
    sanitizedReceipts += 1;
  }
}

console.log(`Reconciled ${mergedRepairs} chapter-scene repair records and sanitized ${sanitizedReceipts} receipt files.`);
