import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PORTABLE_ARCHIVE_CEILING_BYTES,
  RELEASE_PROFILES,
  assertSafeRelativePath,
  assertSamePathSet,
  classifyChapterSceneAsset,
  enumerateSourceAssetPaths,
  hashFile,
} from './release-packaging.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let manifestArgument;
let rehydratedRoot = projectRoot;
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (argument === '--root') {
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error('--root requires a checkout path.');
    rehydratedRoot = path.resolve(value);
    index += 1;
    continue;
  }
  if (argument.startsWith('--') || manifestArgument) throw new Error(`Unknown argument: ${argument}`);
  manifestArgument = argument;
}
if (!manifestArgument) {
  throw new Error('Usage: npm run release:verify-source-assets -- <source-assets.manifest.json> [--root <rehydrated-checkout>]');
}

const manifestPath = path.resolve(manifestArgument);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.schemaVersion !== 1 || manifest.profile !== RELEASE_PROFILES.SOURCE_ASSETS) {
  throw new Error(`Unsupported source-asset manifest: ${manifestPath}`);
}
if (manifest.archiveCeilingBytes !== PORTABLE_ARCHIVE_CEILING_BYTES) {
  throw new Error(`Unexpected source-asset archive ceiling: ${manifest.archiveCeilingBytes}`);
}
if (!Array.isArray(manifest.bundles) || !Array.isArray(manifest.files) || !manifest.files.length) {
  throw new Error('Source-asset manifest is missing bundle or file records.');
}

const bundleNames = new Set();
const bundleRecords = new Map();
for (const bundle of manifest.bundles) {
  if (!bundle.archive || bundleNames.has(bundle.archive)) throw new Error(`Unsafe or duplicate bundle name: ${bundle.archive}`);
  if (path.basename(bundle.archive) !== bundle.archive || !bundle.archive.endsWith('.zip')) {
    throw new Error(`Unsafe source-asset bundle filename: ${bundle.archive}`);
  }
  if (
    !/^[0-9a-f]{64}$/u.test(bundle.sha256)
    || !Number.isSafeInteger(bundle.bytes)
    || bundle.bytes < 0
    || bundle.bytes > PORTABLE_ARCHIVE_CEILING_BYTES
    || !Number.isSafeInteger(bundle.fileCount)
    || bundle.fileCount < 1
    || !Number.isSafeInteger(bundle.sourceBytes)
    || bundle.sourceBytes < 0
  ) {
    throw new Error(`Invalid source-asset bundle integrity record: ${bundle.archive}`);
  }
  bundleNames.add(bundle.archive);
  bundleRecords.set(bundle.archive, bundle);
}

const declared = new Set();
const mappedByBundle = new Map([...bundleNames].map((archive) => [archive, { bytes: 0, files: 0 }]));
let totalBytes = 0;
assertSamePathSet(
  manifest.files.map((record) => record.path),
  enumerateSourceAssetPaths(rehydratedRoot),
  'rehydrated source-asset',
);
for (const record of manifest.files) {
  assertSafeRelativePath(record.path);
  if (declared.has(record.path)) throw new Error(`Duplicate source-asset path: ${record.path}`);
  if (!bundleNames.has(record.bundle)) throw new Error(`Source asset maps to an unknown bundle: ${record.path}`);
  if (classifyChapterSceneAsset(record.path) !== record.category) {
    throw new Error(`Source-asset category mismatch: ${record.path}`);
  }
  if (!/^[0-9a-f]{64}$/u.test(record.sha256) || !Number.isSafeInteger(record.bytes) || record.bytes < 0) {
    throw new Error(`Invalid source-asset integrity record: ${record.path}`);
  }
  const target = path.join(rehydratedRoot, record.path);
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== record.bytes) {
    throw new Error(`Rehydrated source asset is missing or has the wrong size: ${record.path}`);
  }
  if (await hashFile(target) !== record.sha256) throw new Error(`Rehydrated source-asset digest mismatch: ${record.path}`);
  declared.add(record.path);
  totalBytes += record.bytes;
  const mapped = mappedByBundle.get(record.bundle);
  mapped.bytes += record.bytes;
  mapped.files += 1;
}

if (declared.size !== manifest.sourceFileCount || totalBytes !== manifest.sourceBytes) {
  throw new Error('Rehydrated source-asset totals do not match the manifest.');
}
for (const [archive, mapped] of mappedByBundle) {
  const bundle = bundleRecords.get(archive);
  if (mapped.files !== bundle.fileCount || mapped.bytes !== bundle.sourceBytes) {
    throw new Error(`Source-asset bundle totals do not match mapped files: ${archive}`);
  }
}
console.log(`Verified ${declared.size} rehydrated accepted-master and reject-evidence files against ${path.basename(manifestPath)}`);
