import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ARCHIVE_PREFIX,
  COMPREHENSIVE_ARCHIVE_CEILING_BYTES,
  NORMALIZED_TIME,
  PORTABLE_ARCHIVE_CEILING_BYTES,
  RELEASE_PROFILES,
  SOURCE_ASSET_PART_TARGET_BYTES,
  assertArchiveSizeWithinLimit,
  assertSamePathSet,
  assertSnapshotMetadata,
  captureSnapshot,
  classifyChapterSceneAsset,
  copyAndHashSnapshot,
  enumerateSourceAssetPaths,
  hashFile,
  includeReleasePath,
  normalizeDirectoryTimes,
  planSourceAssetBundles,
  verifySnapshotDigest,
  withTemporaryDirectory,
  writeNormalizedJson,
} from './release-packaging.mjs';
import { readAuthenticatedReleaseProfile, resolveChapterSceneSourceMode } from './release-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const usage = `Usage:
  npm run release:package -- [--profile comprehensive-source] [--hold] [--smoke] [--output <archive.zip>]
  npm run release:package:public -- [--hold] [--smoke] [--output <archive.zip>]
  npm run release:package:source-assets -- [--hold] [--smoke] [--output-dir <directory>]

Profiles:
  comprehensive-source  Existing complete source archive, including chapter-scene masters and evidence (default).
  public-repo            Public-repository source package; excludes chapter-scene PNG masters and reject evidence.
  source-assets          Independently checksummed accepted-master and reject-evidence ZIP parts.
`;

const parseArguments = (args) => {
  const options = {
    hold: false,
    output: null,
    outputDir: null,
    profile: RELEASE_PROFILES.COMPREHENSIVE_SOURCE,
    smoke: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    if (argument === '--hold') {
      options.hold = true;
      continue;
    }
    if (argument === '--smoke') {
      options.smoke = true;
      continue;
    }
    if (argument === '--profile' || argument === '--output' || argument === '--output-dir') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value.`);
      index += 1;
      if (argument === '--profile') options.profile = value;
      if (argument === '--output') options.output = value;
      if (argument === '--output-dir') options.outputDir = value;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!Object.values(RELEASE_PROFILES).includes(options.profile)) {
    throw new Error(`Unknown release profile: ${options.profile}`);
  }
  if (options.profile === RELEASE_PROFILES.SOURCE_ASSETS && options.output) {
    throw new Error('--output is not valid for the multi-part source-assets profile; use --output-dir.');
  }
  if (options.profile !== RELEASE_PROFILES.SOURCE_ASSETS && options.outputDir) {
    throw new Error('--output-dir is only valid for the source-assets profile.');
  }
  return options;
};

const run = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? root,
    encoding: options.encoding,
    env: options.env ?? process.env,
    input: options.input,
    shell: false,
    stdio: options.stdio ?? 'inherit',
  });
  if (result.error) throw result.error;
  return result;
};

const packagingGates = [
  ['release security and deployment boundary', 'verify-release-security.mjs'],
  ['public rights and source policy', 'verify-public-release.mjs'],
  ['independent artwork coverage', 'audit-artwork-coverage.mjs'],
];

const runPackagingGates = (hold) => {
  const failures = [];
  for (const [label, script] of packagingGates) {
    console.log(`\n=== packaging gate: ${label} ===`);
    const result = run(process.execPath, [path.join(root, 'scripts', script)]);
    if (result.status !== 0) failures.push(label);
  }
  if (failures.length) {
    throw new Error(`Packaging blocked: ${failures.length} local gate${failures.length === 1 ? '' : 's'} failed: ${failures.join('; ')}. --hold cannot bypass packaging gates.`);
  }
  console.log(`\nPACKAGE READY: all ${packagingGates.length} local source gates passed. Live publication still requires npm run release:check.`);
  if (hold) console.warn('--hold requested: every artifact will be labeled non-publishable even though all local packaging gates passed.');
};

const enumerateGitPaths = (profile) => {
  const listed = run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (listed.status !== 0) throw new Error(listed.stderr || 'Unable to enumerate release source through Git.');
  return [...new Set(listed.stdout.split('\0').filter(Boolean).filter((relative) => includeReleasePath(relative, profile)))]
    .filter((relative) => fs.existsSync(path.join(root, relative)))
    .sort((left, right) => left.localeCompare(right, 'en'));
};

const requiredFiles = ['README.md', 'LICENSE', 'NOTICE.md', 'package.json', 'package-lock.json', 'wrangler.jsonc'];
const assertRequiredFiles = (files) => {
  if (!files.length) throw new Error('Git enumeration produced no release files.');
  for (const required of requiredFiles) {
    if (!files.includes(required)) throw new Error(`Release file selection omitted required source: ${required}`);
  }
};

const assertOutputLocation = (absolute) => {
  const relative = path.relative(root, absolute);
  const insideRoot = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  if (insideRoot && relative !== 'outputs' && !relative.startsWith(`outputs${path.sep}`)) {
    throw new Error(`Release outputs inside the checkout must stay under outputs/: ${absolute}`);
  }
};

const assertOutputsAbsent = (outputs) => {
  for (const output of outputs) {
    assertOutputLocation(output);
    if (fs.existsSync(output)) throw new Error(`Refusing to overwrite an existing release artifact: ${output}`);
  }
};

const makePartialPath = (destination) => {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const extension = path.extname(destination);
  const stem = path.basename(destination, extension);
  return path.join(path.dirname(destination), `.${stem}.partial-${process.pid}-${crypto.randomUUID()}${extension}`);
};

const commitNoReplace = (partial, destination) => {
  fs.linkSync(partial, destination);
  fs.unlinkSync(partial);
};

const writePartialText = (destination, contents, partials) => {
  const partial = makePartialPath(destination);
  fs.writeFileSync(partial, contents, { encoding: 'utf8', flag: 'wx' });
  partials.add(partial);
  return partial;
};

const removeCreated = (files) => {
  for (const file of files) {
    try {
      fs.rmSync(file, { force: true });
    } catch (error) {
      console.warn(`Unable to clean incomplete release output ${file}: ${error.message}`);
    }
  }
};

const createZip = (stagingDirectory, archiveFiles, destination, partials) => {
  const partial = makePartialPath(destination);
  partials.add(partial);
  const result = run('zip', ['-X', '-q', partial, '-@'], {
    cwd: stagingDirectory,
    encoding: 'utf8',
    input: `${archiveFiles.join('\n')}\n`,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (result.status !== 0) throw new Error('zip failed. Install a standard Info-ZIP compatible `zip` command.');
  const tested = run('unzip', ['-tqq', partial], { encoding: 'utf8', stdio: 'pipe' });
  if (tested.status !== 0) throw new Error(tested.stderr || `Archive integrity test failed: ${destination}`);
  const listing = run('unzip', ['-Z1', partial], { encoding: 'utf8', stdio: 'pipe' });
  if (listing.status !== 0) throw new Error(listing.stderr || `Unable to list archive entries: ${destination}`);
  assertSamePathSet(archiveFiles, listing.stdout.split(/\r?\n/u).filter(Boolean), 'archive entry');
  return partial;
};

const writeNormalizedText = (absolute, contents) => {
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, contents, { encoding: 'utf8', flag: 'wx' });
  fs.utimesSync(absolute, NORMALIZED_TIME, NORMALIZED_TIME);
};

const holdNotice = [
  'RELEASE HOLD — NOT AUTHORIZED FOR PUBLICATION',
  '',
  'This review artifact was created with the explicit --hold option.',
  'See README.md and run npm run release:check for the current blockers.',
  'A technically valid build is not publication authorization.',
  '',
].join('\n');

const validateFrozenSnapshot = async (snapshots, digests, enumerateCurrent, label) => {
  const current = enumerateCurrent();
  assertSamePathSet(snapshots.map((snapshot) => snapshot.relative), current, label);
  for (const snapshot of snapshots) {
    const digest = digests.get(snapshot.relative);
    if (!digest) throw new Error(`Missing staged digest for release source: ${snapshot.relative}`);
    await verifySnapshotDigest(root, snapshot, digest);
  }
};

const validateFrozenMetadata = (snapshots, enumerateCurrent, label) => {
  assertSamePathSet(snapshots.map((snapshot) => snapshot.relative), enumerateCurrent(), label);
  for (const snapshot of snapshots) assertSnapshotMetadata(root, snapshot);
};

const commitArtifacts = (pairs, partials, committed) => {
  for (const { destination, partial } of pairs) {
    commitNoReplace(partial, destination);
    partials.delete(partial);
    committed.add(destination);
  }
};

const packageSourceArchive = async (options, output) => {
  if (path.extname(output).toLowerCase() !== '.zip') throw new Error(`Release archive output must end in .zip: ${output}`);
  const profile = options.profile;
  const chapterSceneProvenance = JSON.parse(
    fs.readFileSync(path.join(root, 'assets-source', 'chapter-scenes-provenance.json'), 'utf8'),
  );
  const authenticatedInputProfile = readAuthenticatedReleaseProfile(root);
  const chapterSceneSourceMode = resolveChapterSceneSourceMode(
    root,
    chapterSceneProvenance.records,
    authenticatedInputProfile,
  );
  const localSourceAssetPaths = enumerateSourceAssetPaths(root, { allowEmpty: true });
  if (chapterSceneSourceMode === 'prebuilt-public' && localSourceAssetPaths.length !== 0) {
    throw new Error('Authenticated public-repo input contains unexpected chapter-scene source or reject-evidence files.');
  }

  const enumerateArchivePaths = () => {
    const gitPaths = enumerateGitPaths(profile);
    if (profile !== RELEASE_PROFILES.COMPREHENSIVE_SOURCE) return gitPaths;
    if (chapterSceneSourceMode !== 'masters') {
      throw new Error('The comprehensive-source profile requires the complete chapter-scene preservation-master snapshot.');
    }
    const strictSourceAssetPaths = enumerateSourceAssetPaths(root);
    return [...new Set([...gitPaths, ...strictSourceAssetPaths])]
      .sort((left, right) => left.localeCompare(right, 'en'));
  };
  const paths = enumerateArchivePaths();
  assertRequiredFiles(paths);
  const snapshots = paths.map((relative) => captureSnapshot(root, relative));
  let excludedSourceAssetSnapshots = [];
  let chapterSceneSourceSnapshot = 'materialized-and-included';
  if (profile === RELEASE_PROFILES.PUBLIC_REPO) {
    const excludedSourceAssetPaths = chapterSceneSourceMode === 'masters'
      ? enumerateSourceAssetPaths(root)
      : [];
    const excludedSourceAssetSet = new Set(excludedSourceAssetPaths);
    const selected = new Set(paths);
    if (excludedSourceAssetPaths.some((relative) => selected.has(relative))) {
      throw new Error('Public-repo selection retained a chapter-scene source/evidence file.');
    }
    const comprehensivePaths = enumerateGitPaths(RELEASE_PROFILES.COMPREHENSIVE_SOURCE);
    const omittedGitPaths = comprehensivePaths.filter((relative) => !selected.has(relative));
    const unexpectedOmission = omittedGitPaths.find((relative) => !excludedSourceAssetSet.has(relative));
    if (unexpectedOmission) throw new Error(`Public-repo profile unexpectedly omitted non-source metadata: ${unexpectedOmission}`);
    excludedSourceAssetSnapshots = excludedSourceAssetPaths.map((relative) => captureSnapshot(root, relative));
    chapterSceneSourceSnapshot = chapterSceneSourceMode === 'masters'
      ? 'materialized-and-excluded'
      : 'absent-authenticated-public-repo';
  }
  const sourceBytes = snapshots.reduce((sum, snapshot) => sum + snapshot.size, 0);
  const archiveCeilingBytes = profile === RELEASE_PROFILES.PUBLIC_REPO
    ? PORTABLE_ARCHIVE_CEILING_BYTES
    : COMPREHENSIVE_ARCHIVE_CEILING_BYTES;
  if (sourceBytes > archiveCeilingBytes) {
    throw new Error(`${profile} source selection exceeds its conservative ${archiveCeilingBytes}-byte input ceiling.`);
  }
  const checksumOutput = `${output}.sha256`;
  assertOutputsAbsent([output, checksumOutput]);

  const partials = new Set();
  const committed = new Set();
  try {
    await withTemporaryDirectory('naturalis-historia-package-', async (temporary) => {
      const stagedRoot = path.join(temporary, ARCHIVE_PREFIX);
      fs.mkdirSync(stagedRoot, { recursive: true });
      const manifest = [];
      const digests = new Map();
      for (const snapshot of snapshots) {
        const digest = await copyAndHashSnapshot(root, snapshot, path.join(stagedRoot, snapshot.relative));
        digests.set(snapshot.relative, digest);
        manifest.push(`${digest}  ${snapshot.relative}`);
      }

      const profileRelative = 'RELEASE-PROFILE.json';
      const profilePath = path.join(stagedRoot, profileRelative);
      const excludedChapterSceneClasses = [...new Set(
        excludedSourceAssetSnapshots.map((snapshot) => classifyChapterSceneAsset(snapshot.relative)),
      )].sort((left, right) => left.localeCompare(right, 'en'));
      writeNormalizedJson(profilePath, {
        archiveCeilingBytes,
        chapterSceneSourceSnapshot,
        excludedChapterSceneClasses,
        excludedSourceAssetBytes: excludedSourceAssetSnapshots.reduce((sum, snapshot) => sum + snapshot.size, 0),
        excludedSourceAssetFileCount: excludedSourceAssetSnapshots.length,
        normalizedTimestamp: NORMALIZED_TIME.toISOString(),
        packagingGateScripts: packagingGates.map(([, script]) => `scripts/${script}`),
        packagingPreflightPassed: true,
        profile,
        publicationGate: 'not-evaluated-by-packager; run npm run release:check before deployment',
        publicationStatus: options.hold ? 'explicit-hold' : 'external-release-check-required',
        schemaVersion: 1,
        sourceAssetManifest: profile === RELEASE_PROFILES.PUBLIC_REPO && excludedSourceAssetSnapshots.length > 0
          ? `naturalis-historia-${packageJson.version}${options.hold ? '-HOLD' : ''}-source-assets.manifest.json`
          : null,
        sourceBytes,
        sourceFileCount: snapshots.length,
      });
      manifest.push(`${await hashFile(profilePath)}  ${profileRelative}`);

      if (options.hold) {
        const holdPath = path.join(stagedRoot, 'RELEASE-HOLD.txt');
        writeNormalizedText(holdPath, holdNotice);
        manifest.push(`${await hashFile(holdPath)}  RELEASE-HOLD.txt`);
      }

      manifest.sort((left, right) => left.localeCompare(right, 'en'));
      const manifestPath = path.join(stagedRoot, 'RELEASE-MANIFEST.sha256');
      writeNormalizedText(manifestPath, `${manifest.join('\n')}\n`);
      normalizeDirectoryTimes(stagedRoot);

      const archiveFiles = manifest.map((line) => `${ARCHIVE_PREFIX}/${line.slice(66)}`);
      archiveFiles.push(`${ARCHIVE_PREFIX}/RELEASE-MANIFEST.sha256`);
      archiveFiles.sort((left, right) => left.localeCompare(right, 'en'));
      const partialArchive = createZip(temporary, archiveFiles, output, partials);
      assertArchiveSizeWithinLimit(partialArchive, archiveCeilingBytes);

      if (options.smoke) {
        const result = run(process.execPath, [path.join(root, 'scripts', 'smoke-release-archive.mjs'), partialArchive, '--offline']);
        if (result.status !== 0) throw new Error('Fresh extracted archive smoke failed.');
      }

      const archiveDigest = await hashFile(partialArchive);
      await validateFrozenSnapshot(snapshots, digests, enumerateArchivePaths, `${profile} source`);
      const partialChecksum = writePartialText(
        checksumOutput,
        `${archiveDigest}  ${path.basename(output)}\n`,
        partials,
      );
      validateFrozenMetadata(snapshots, enumerateArchivePaths, `${profile} source`);
      if (profile === RELEASE_PROFILES.PUBLIC_REPO) {
        validateFrozenMetadata(
          excludedSourceAssetSnapshots,
          () => enumerateSourceAssetPaths(root, { allowEmpty: chapterSceneSourceMode === 'prebuilt-public' }),
          'public-repo excluded source-asset',
        );
      }
      commitArtifacts([
        { destination: output, partial: partialArchive },
        { destination: checksumOutput, partial: partialChecksum },
      ], partials, committed);
      console.log(`Created ${profile} archive with ${snapshots.length} source files plus release metadata: ${output}`);
      console.log(`SHA-256 ${archiveDigest}`);
    });
  } catch (error) {
    removeCreated(committed);
    throw error;
  } finally {
    removeCreated(partials);
  }
};

const packageSourceAssets = async (options, outputDirectory) => {
  const paths = enumerateSourceAssetPaths(root);
  const snapshots = paths.map((relative) => captureSnapshot(root, relative));
  const bundles = planSourceAssetBundles(snapshots, packageJson.version, options.hold);
  const label = options.hold
    ? `naturalis-historia-${packageJson.version}-HOLD-source-assets`
    : `naturalis-historia-${packageJson.version}-source-assets`;
  const manifestOutput = path.join(outputDirectory, `${label}.manifest.json`);
  const manifestChecksumOutput = `${manifestOutput}.sha256`;
  const plannedOutputs = [manifestOutput, manifestChecksumOutput];
  for (const bundle of bundles) {
    const archive = path.join(outputDirectory, bundle.archive);
    plannedOutputs.push(archive, `${archive}.sha256`);
  }
  assertOutputsAbsent(plannedOutputs);

  const partials = new Set();
  const committed = new Set();
  try {
    await withTemporaryDirectory('naturalis-historia-source-assets-', async (temporary) => {
      const digests = new Map();
      const builtBundles = [];
      for (const [index, bundle] of bundles.entries()) {
        const stagingDirectory = path.join(temporary, `bundle-${String(index + 1).padStart(3, '0')}`);
        const stagedRoot = path.join(stagingDirectory, ARCHIVE_PREFIX);
        fs.mkdirSync(stagedRoot, { recursive: true });
        const entries = [];
        for (const snapshot of bundle.entries) {
          const digest = await copyAndHashSnapshot(root, snapshot, path.join(stagedRoot, snapshot.relative));
          digests.set(snapshot.relative, digest);
          entries.push({ bytes: snapshot.size, path: snapshot.relative, sha256: digest });
        }

        const bundleManifestRelative = `assets-source/bundle-manifests/${bundle.id}.json`;
        writeNormalizedJson(path.join(stagedRoot, bundleManifestRelative), {
          archive: bundle.archive,
          archiveCeilingBytes: PORTABLE_ARCHIVE_CEILING_BYTES,
          category: bundle.category,
          files: entries,
          id: bundle.id,
          normalizedTimestamp: NORMALIZED_TIME.toISOString(),
          rehydrationRoot: `${ARCHIVE_PREFIX}/`,
          schemaVersion: 1,
          sourceBytes: bundle.sourceBytes,
        });
        if (options.hold) writeNormalizedText(path.join(stagedRoot, 'RELEASE-HOLD.txt'), holdNotice);
        normalizeDirectoryTimes(stagedRoot);

        const archiveFiles = entries.map((entry) => `${ARCHIVE_PREFIX}/${entry.path}`);
        archiveFiles.push(`${ARCHIVE_PREFIX}/${bundleManifestRelative}`);
        if (options.hold) archiveFiles.push(`${ARCHIVE_PREFIX}/RELEASE-HOLD.txt`);
        archiveFiles.sort((left, right) => left.localeCompare(right, 'en'));
        const archiveOutput = path.join(outputDirectory, bundle.archive);
        const partialArchive = createZip(stagingDirectory, archiveFiles, archiveOutput, partials);
        const archiveBytes = assertArchiveSizeWithinLimit(partialArchive, PORTABLE_ARCHIVE_CEILING_BYTES);
        builtBundles.push({
          ...bundle,
          archiveBytes,
          archiveOutput,
          entries,
          partialArchive,
        });
      }

      for (const bundle of builtBundles) bundle.archiveSha256 = await hashFile(bundle.partialArchive);
      await validateFrozenSnapshot(snapshots, digests, () => enumerateSourceAssetPaths(root), 'source-asset');
      const bundleForPath = new Map();
      for (const bundle of builtBundles) {
        for (const entry of bundle.entries) {
          if (bundleForPath.has(entry.path)) throw new Error(`Source asset was assigned to multiple bundles: ${entry.path}`);
          bundleForPath.set(entry.path, bundle.archive);
        }
      }
      assertSamePathSet(paths, bundleForPath.keys(), 'source-asset manifest');

      const globalManifest = {
        archiveCeilingBytes: PORTABLE_ARCHIVE_CEILING_BYTES,
        bundles: builtBundles.map((bundle) => ({
          archive: bundle.archive,
          bytes: bundle.archiveBytes,
          category: bundle.category,
          fileCount: bundle.entries.length,
          id: bundle.id,
          sha256: bundle.archiveSha256,
          sourceBytes: bundle.sourceBytes,
        })),
        files: snapshots.map((snapshot) => ({
          bundle: bundleForPath.get(snapshot.relative),
          bytes: snapshot.size,
          category: classifyChapterSceneAsset(snapshot.relative),
          path: snapshot.relative,
          sha256: digests.get(snapshot.relative),
        })),
        normalizedTimestamp: NORMALIZED_TIME.toISOString(),
        partTargetSourceBytes: SOURCE_ASSET_PART_TARGET_BYTES,
        profile: RELEASE_PROFILES.SOURCE_ASSETS,
        rehydrationRoot: `${ARCHIVE_PREFIX}/`,
        schemaVersion: 1,
        sourceBytes: snapshots.reduce((sum, snapshot) => sum + snapshot.size, 0),
        sourceFileCount: snapshots.length,
      };
      const partialManifest = makePartialPath(manifestOutput);
      partials.add(partialManifest);
      fs.writeFileSync(partialManifest, `${JSON.stringify(globalManifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      const manifestDigest = await hashFile(partialManifest);

      const commitPairs = [];
      for (const bundle of builtBundles) {
        const checksumOutput = `${bundle.archiveOutput}.sha256`;
        const partialChecksum = writePartialText(
          checksumOutput,
          `${bundle.archiveSha256}  ${bundle.archive}\n`,
          partials,
        );
        commitPairs.push(
          { destination: bundle.archiveOutput, partial: bundle.partialArchive },
          { destination: checksumOutput, partial: partialChecksum },
        );
      }
      const partialManifestChecksum = writePartialText(
        manifestChecksumOutput,
        `${manifestDigest}  ${path.basename(manifestOutput)}\n`,
        partials,
      );
      commitPairs.push(
        { destination: manifestOutput, partial: partialManifest },
        { destination: manifestChecksumOutput, partial: partialManifestChecksum },
      );
      validateFrozenMetadata(snapshots, () => enumerateSourceAssetPaths(root), 'source-asset');
      commitArtifacts(commitPairs, partials, committed);

      console.log(`Created ${builtBundles.length} independently checksummed source-asset parts for ${snapshots.length} files.`);
      console.log(`Source-asset mapping manifest: ${manifestOutput}`);
      if (options.smoke) console.log('Source-asset smoke: every part passed unzip integrity, size, source-snapshot, and SHA-256 checks.');
    });
  } catch (error) {
    removeCreated(committed);
    throw error;
  } finally {
    removeCreated(partials);
  }
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage);
    return;
  }
  runPackagingGates(options.hold);
  if (options.profile === RELEASE_PROFILES.SOURCE_ASSETS) {
    const outputDirectory = path.resolve(root, options.outputDir ?? path.join('outputs', 'releases'));
    await packageSourceAssets(options, outputDirectory);
    return;
  }
  const suffix = options.profile === RELEASE_PROFILES.PUBLIC_REPO ? '-public-repo' : '';
  const holdSuffix = options.hold ? '-HOLD' : '';
  const defaultName = `naturalis-historia-${packageJson.version}${suffix}${holdSuffix}.zip`;
  const output = path.resolve(root, options.output ?? path.join('outputs', 'releases', defaultName));
  await packageSourceArchive(options, output);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
