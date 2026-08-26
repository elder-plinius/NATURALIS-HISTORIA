import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GITHUB_RELEASE_ASSET_CEILING_BYTES,
  PORTABLE_ARCHIVE_CEILING_BYTES,
  RELEASE_PROFILES,
  SOURCE_ASSET_PART_TARGET_BYTES,
  assertArchiveSizeWithinLimit,
  assertSamePathSet,
  captureSnapshot,
  classifyChapterSceneAsset,
  copyAndHashSnapshot,
  enumerateSourceAssetPaths,
  hashFile,
  includeReleasePath,
  planSourceAssetBundles,
  verifySnapshotDigest,
  withTemporaryDirectory,
} from './release-packaging.mjs';
import { readAuthenticatedReleaseProfile, resolveChapterSceneSourceMode } from './release-profile.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..');

const packageScript = fs.readFileSync(path.join(scriptDirectory, 'package-release.mjs'), 'utf8');
for (const requiredGate of [
  'verify-release-security.mjs',
  'verify-public-release.mjs',
  'audit-artwork-coverage.mjs',
]) {
  assert.ok(packageScript.includes(requiredGate), `Packager is missing local gate ${requiredGate}`);
}
assert.ok(!packageScript.includes("path.join(root, 'scripts', 'release-check.mjs')"), 'Packager must not require live DNS before it can create the repository ZIP.');
assert.ok(!packageScript.includes('verify-production-domain.mjs'), 'Packager must not run the live DNS gate.');
assert.ok(packageScript.includes('--hold cannot bypass packaging gates'), '--hold must not bypass any local packaging gate.');
assert.ok(packageScript.includes("publicationGate: 'not-evaluated-by-packager; run npm run release:check before deployment'"), 'Authenticated release profile must preserve the live-publication boundary.');
assert.ok(packageScript.includes('packagingPreflightPassed: true'), 'Authenticated release profile must record the local packaging preflight without claiming live publication readiness.');
assert.ok(packageScript.includes("'absent-authenticated-public-repo'"), 'Public packager must disclose an authenticated prebuilt input with no local source-asset snapshot.');
assert.ok(packageScript.includes("'materialized-and-excluded'"), 'Public packager must distinguish source assets it actually excluded.');
assert.ok(
  packageScript.includes("chapterSceneSourceMode !== 'masters'")
    && packageScript.includes('The comprehensive-source profile requires the complete chapter-scene preservation-master snapshot.'),
  'Comprehensive packaging must retain a strict complete-source path.',
);

const archiveSmokeScript = fs.readFileSync(path.join(scriptDirectory, 'smoke-release-archive.mjs'), 'utf8');
assert.ok(archiveSmokeScript.includes("profile.sourceAssetManifest !== null"), 'Archive smoke must reject a fabricated source-asset manifest for prebuilt public input.');
assert.ok(archiveSmokeScript.includes("profile.excludedSourceAssetFileCount !== 0"), 'Archive smoke must reject fabricated excluded-file counts for prebuilt public input.');

const releaseCheckScript = fs.readFileSync(path.join(scriptDirectory, 'release-check.mjs'), 'utf8');
for (const requiredPublicationGate of [
  'verify-release-security.mjs',
  'verify-public-release.mjs',
  'audit-artwork-coverage.mjs',
  'verify-production-domain.mjs',
]) {
  assert.ok(releaseCheckScript.includes(requiredPublicationGate), `Publication check is missing ${requiredPublicationGate}`);
}
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(packageJson.scripts['release:build'], 'npm run release:check && npm run build');
assert.equal(packageJson.scripts.deploy, 'npm run release:build && npm run deploy:built');

const afterwordVerifier = fs.readFileSync(path.join(scriptDirectory, 'verify-vesuvius-afterword.mjs'), 'utf8');
assert.ok(afterwordVerifier.includes('resolveChapterSceneSourceMode'), 'Afterword verifier must support the authenticated public-repo profile.');
assert.ok(afterwordVerifier.includes("chapterSceneSourceMode === 'masters'"), 'Afterword verifier must only read omitted preservation masters in complete-source mode.');
assert.ok(afterwordVerifier.includes("releaseProfile?.profile, 'public-repo'"), 'Afterword public-profile fallback must require authenticated public-repo metadata.');

const accepted = 'assets-source/chapter-scenes-v1/cosmos-wave-01/b02-c001.png';
const rejected = 'assets-source/chapter-scenes-v1/cosmos-wave-01/evidence/history/b02-c001-rejected.png';
const repair = 'assets-source/chapter-scenes-v1/cosmos-wave-01/evidence/b02-c001-repair.json';
const receipt = 'assets-source/chapter-scenes-v1/cosmos-wave-01/receipt.json';

assert.equal(classifyChapterSceneAsset(accepted), 'accepted-master');
assert.equal(classifyChapterSceneAsset(rejected), 'reject-evidence');
assert.equal(classifyChapterSceneAsset(repair), 'reject-evidence');
assert.equal(classifyChapterSceneAsset(receipt), null);
assert.equal(classifyChapterSceneAsset('public/assets/b02-c001.12345678.w512.webp'), null);

for (const relative of [accepted, rejected, repair]) {
  assert.equal(includeReleasePath(relative, RELEASE_PROFILES.COMPREHENSIVE_SOURCE), true);
  assert.equal(includeReleasePath(relative, RELEASE_PROFILES.PUBLIC_REPO), false);
}
for (const relative of [
  receipt,
  'assets-source/chapter-scenes-provenance.json',
  'assets-source/chapter-artwork-manifest.json',
  'scripts/package-release.mjs',
  'public/assets/b02-c001.12345678.w512.webp',
]) {
  assert.equal(includeReleasePath(relative, RELEASE_PROFILES.PUBLIC_REPO), true);
}

assert.ok(PORTABLE_ARCHIVE_CEILING_BYTES < GITHUB_RELEASE_ASSET_CEILING_BYTES);
assert.ok(SOURCE_ASSET_PART_TARGET_BYTES < PORTABLE_ARCHIVE_CEILING_BYTES);
const fakeSnapshots = [
  { relative: accepted, size: 700_000_000 },
  { relative: 'assets-source/chapter-scenes-v1/cosmos-wave-01/b02-c002.png', size: 700_000_000 },
  { relative: 'assets-source/chapter-scenes-v1/cosmos-wave-01/b02-c003.png', size: 20_000_000 },
  { relative: rejected, size: 800_000_000 },
  { relative: 'assets-source/chapter-scenes-v1/cosmos-wave-01/evidence/history/b02-c002-rejected.png', size: 600_000_000 },
];
const bundles = planSourceAssetBundles(fakeSnapshots, '1.0.0');
assert.equal(bundles.length, 4);
assert.ok(bundles.every((bundle) => bundle.sourceBytes <= SOURCE_ASSET_PART_TARGET_BYTES));
assert.ok(bundles.some((bundle) => bundle.category === 'accepted-master'));
assert.ok(bundles.some((bundle) => bundle.category === 'reject-evidence'));
assertSamePathSet(
  fakeSnapshots.map((snapshot) => snapshot.relative),
  bundles.flatMap((bundle) => bundle.entries.map((entry) => entry.relative)),
  'test bundle plan',
);
assert.throws(() => assertSamePathSet(['one'], ['two'], 'test snapshot'), /file set changed/u);

let failedTemporary;
await assert.rejects(
  withTemporaryDirectory('naturalis-package-cleanup-test-', async (temporary) => {
    failedTemporary = temporary;
    fs.writeFileSync(path.join(temporary, 'marker'), 'cleanup', 'utf8');
    throw new Error('intentional cleanup test');
  }),
  /intentional cleanup test/u,
);
assert.equal(fs.existsSync(failedTemporary), false);

await withTemporaryDirectory('naturalis-package-snapshot-test-', async (temporary) => {
  const sourceRoot = path.join(temporary, 'source');
  const stagedRoot = path.join(temporary, 'staged');
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, 'sample.bin'), 'stable source bytes', 'utf8');
  const snapshot = captureSnapshot(sourceRoot, 'sample.bin');
  const destination = path.join(stagedRoot, 'sample.bin');
  const digest = await copyAndHashSnapshot(sourceRoot, snapshot, destination);
  const expected = crypto.createHash('sha256').update('stable source bytes').digest('hex');
  assert.equal(digest, expected);
  assert.equal(await hashFile(destination), expected);
  await verifySnapshotDigest(sourceRoot, snapshot, digest);
  assert.equal(assertArchiveSizeWithinLimit(destination, 100), Buffer.byteLength('stable source bytes'));
  assert.throws(() => assertArchiveSizeWithinLimit(destination, 2), /exceeds/u);
  fs.writeFileSync(path.join(sourceRoot, 'sample.bin'), 'changed source bytes', 'utf8');
  await assert.rejects(verifySnapshotDigest(sourceRoot, snapshot, digest), /changed during packaging/u);
});

await withTemporaryDirectory('naturalis-package-source-enumeration-test-', async (temporary) => {
  const campaign = path.join(temporary, 'assets-source', 'chapter-scenes-v1', 'test-wave');
  fs.mkdirSync(campaign, { recursive: true });
  fs.writeFileSync(path.join(campaign, 'receipt.json'), '{}\n', 'utf8');
  assert.deepEqual(enumerateSourceAssetPaths(temporary, { allowEmpty: true }), []);
  assert.throws(() => enumerateSourceAssetPaths(temporary), /No chapter-scene source assets/u);
  fs.writeFileSync(path.join(campaign, 'b01-c001.png'), 'master fixture', 'utf8');
  assert.deepEqual(
    enumerateSourceAssetPaths(temporary),
    ['assets-source/chapter-scenes-v1/test-wave/b01-c001.png'],
  );
});

await withTemporaryDirectory('naturalis-package-rehydrate-test-', async (temporary) => {
  const rehydratedRoot = path.join(temporary, 'naturalis-historia');
  const relative = 'assets-source/chapter-scenes-v1/test-wave/b01-c001.png';
  const target = path.join(rehydratedRoot, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const contents = 'accepted master fixture';
  fs.writeFileSync(target, contents, 'utf8');
  const digest = crypto.createHash('sha256').update(contents).digest('hex');
  const bundle = 'naturalis-historia-1.0.0-source-assets-accepted-masters.part-001-of-001.zip';
  const manifestPath = path.join(temporary, 'source-assets.manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    archiveCeilingBytes: PORTABLE_ARCHIVE_CEILING_BYTES,
    bundles: [{
      archive: bundle,
      bytes: 100,
      category: 'accepted-master',
      fileCount: 1,
      id: 'accepted-masters.part-001-of-001',
      sha256: '0'.repeat(64),
      sourceBytes: Buffer.byteLength(contents),
    }],
    files: [{
      bundle,
      bytes: Buffer.byteLength(contents),
      category: 'accepted-master',
      path: relative,
      sha256: digest,
    }],
    profile: RELEASE_PROFILES.SOURCE_ASSETS,
    schemaVersion: 1,
    sourceBytes: Buffer.byteLength(contents),
    sourceFileCount: 1,
  }, null, 2)}\n`, 'utf8');
  const verified = spawnSync(process.execPath, [
    path.join(scriptDirectory, 'verify-source-asset-bundles.mjs'),
    manifestPath,
    '--root',
    rehydratedRoot,
  ], { encoding: 'utf8', stdio: 'pipe' });
  assert.equal(verified.status, 0, verified.stderr);
  fs.writeFileSync(target, 'corrupted fixture', 'utf8');
  const rejectedResult = spawnSync(process.execPath, [
    path.join(scriptDirectory, 'verify-source-asset-bundles.mjs'),
    manifestPath,
    '--root',
    rehydratedRoot,
  ], { encoding: 'utf8', stdio: 'pipe' });
  assert.notEqual(rejectedResult.status, 0);
});

await withTemporaryDirectory('naturalis-package-profile-test-', async (temporary) => {
  assert.equal(readAuthenticatedReleaseProfile(temporary), null);
  const profileText = `${JSON.stringify({ profile: 'public-repo', schemaVersion: 1 }, null, 2)}\n`;
  const profileDigest = crypto.createHash('sha256').update(profileText).digest('hex');
  fs.writeFileSync(path.join(temporary, 'RELEASE-PROFILE.json'), profileText, 'utf8');
  fs.writeFileSync(path.join(temporary, 'RELEASE-MANIFEST.sha256'), `${profileDigest}  RELEASE-PROFILE.json\n`, 'utf8');
  const profile = readAuthenticatedReleaseProfile(temporary);
  assert.equal(profile.profile, 'public-repo');
  const records = {
    one: { sourceArtifact: 'assets-source/chapter-scenes-v1/test-wave/b01-c001.png' },
    two: { sourceArtifact: 'assets-source/chapter-scenes-v1/test-wave/b01-c002.png' },
  };
  assert.equal(resolveChapterSceneSourceMode(temporary, records, profile), 'prebuilt-public');
  fs.mkdirSync(path.join(temporary, 'assets-source/chapter-scenes-v1/test-wave'), { recursive: true });
  fs.writeFileSync(path.join(temporary, records.one.sourceArtifact), 'one', 'utf8');
  assert.throws(() => resolveChapterSceneSourceMode(temporary, records, profile), /snapshot is partial/u);
  fs.writeFileSync(path.join(temporary, records.two.sourceArtifact), 'two', 'utf8');
  assert.equal(resolveChapterSceneSourceMode(temporary, records, profile), 'masters');
  fs.writeFileSync(path.join(temporary, 'RELEASE-PROFILE.json'), `${profileText} `, 'utf8');
  assert.throws(() => readAuthenticatedReleaseProfile(temporary), /not authenticated/u);
});

console.log('Verified packaging/publication gate separation, authenticated release profiles, lossless source-asset partitioning/rehydration, archive ceilings, streamed hashing, snapshot failure, and finally cleanup');
