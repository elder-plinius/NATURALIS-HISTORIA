import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sceneRoot = path.join(root, 'assets-source', 'chapter-scenes-v1');
const campaign = process.argv[2];

if (!campaign || !/^[a-z0-9-]+$/i.test(campaign)) {
  throw new Error('Usage: node scripts/audit-chapter-scene-campaign.mjs <campaign-directory>');
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'evidence') files.push(...await walk(absolute));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      files.push(absolute);
    }
  }
  return files;
}

function chapterKeyFromFile(file) {
  const match = path.basename(file).match(/^b(\d+)-c(\d+)\.png$/i);
  return match ? `${Number(match[1])}:${Number(match[2])}` : null;
}

function hamming(left, right) {
  return left.reduce((sum, bit, index) => sum + Number(bit !== right[index]), 0);
}

const files = (await walk(sceneRoot)).sort();
const targetDirectory = path.join(sceneRoot, campaign);
const targets = new Set(files.filter((file) => path.dirname(file) === targetDirectory));
if (!targets.size) throw new Error(`No direct PNG masters found in ${campaign}.`);

const fingerprints = [];
const hashes = new Map();
for (const file of files) {
  const bytes = await readFile(file);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const metadata = await sharp(bytes).metadata();
  if (metadata.width !== 1536 || metadata.height !== 1024 || metadata.hasAlpha || metadata.space !== 'srgb') {
    throw new Error(`${path.relative(root, file)} is not a 1536x1024 opaque sRGB master.`);
  }
  const { data } = await sharp(bytes).resize(32, 32, { fit: 'fill' }).greyscale().raw()
    .toBuffer({ resolveWithObject: true });
  const { data: hashData } = await sharp(bytes).resize(9, 8, { fit: 'fill' }).greyscale().raw()
    .toBuffer({ resolveWithObject: true });
  const differenceHash = [];
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      differenceHash.push(hashData[row * 9 + column] > hashData[row * 9 + column + 1]);
    }
  }
  const relative = path.relative(root, file);
  const chapterKey = chapterKeyFromFile(file);
  fingerprints.push({ file, relative, chapterKey, sha256, data, differenceHash });
  const peers = hashes.get(sha256) ?? [];
  peers.push(relative);
  hashes.set(sha256, peers);
}

const exactDuplicatePairs = [...hashes.values()]
  .filter((peers) => peers.length > 1)
  .reduce((sum, peers) => sum + (peers.length * (peers.length - 1)) / 2, 0);
const chapters = {};
let gatePass = exactDuplicatePairs === 0;

for (const target of fingerprints.filter((entry) => targets.has(entry.file))) {
  let nearestMad = Number.POSITIVE_INFINITY;
  let madPeer;
  let dHashAtMadPeer;
  let nearestDHash = Number.POSITIVE_INFINITY;
  let dHashPeer;
  let madAtDHashPeer;
  for (const peer of fingerprints) {
    if (peer.file === target.file) continue;
    let totalDifference = 0;
    for (let index = 0; index < target.data.length; index += 1) {
      totalDifference += Math.abs(target.data[index] - peer.data[index]);
    }
    const mad = totalDifference / target.data.length;
    const dHash = hamming(target.differenceHash, peer.differenceHash);
    if (mad < nearestMad) {
      nearestMad = mad;
      madPeer = peer.relative;
      dHashAtMadPeer = dHash;
    }
    if (dHash < nearestDHash) {
      nearestDHash = dHash;
      dHashPeer = peer.relative;
      madAtDHashPeer = mad;
    }
  }
  const key = target.chapterKey ?? target.relative;
  chapters[key] = {
    nearestMAD: Number(nearestMad.toFixed(2)),
    madPeer,
    dHashAtMadPeer,
    nearestDHash,
    dHashPeer,
    madAtDHashPeer: Number(madAtDHashPeer.toFixed(2)),
  };
  if (nearestMad < 20 || nearestDHash < 10) gatePass = false;
}

const report = {
  performedAt: new Date().toISOString().slice(0, 10),
  scope: 'All non-evidence PNG masters under assets-source/chapter-scenes-v1 at scan time',
  canonicalCountAtScan: files.length,
  method: 'Nearest-neighbor comparison using 32x32 grayscale mean absolute difference and 9x8 perceptual dHash; exact SHA-256 duplicates also checked.',
  thresholds: { minimumMAD: 20, minimumDHash: 10 },
  exactDuplicatePairs,
  newExactDuplicatePairs: [...targets].filter((file) => hashes.get(fingerprints.find((entry) => entry.file === file).sha256).length > 1).length,
  gatePass,
  chapters,
};

console.log(JSON.stringify(report, null, 2));
if (!gatePass) process.exitCode = 1;
