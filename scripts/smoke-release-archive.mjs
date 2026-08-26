import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const archiveArgument = args.find((arg) => !arg.startsWith('--'));
const offline = args.includes('--offline');
for (const arg of args) {
  if (arg !== archiveArgument && arg !== '--offline') throw new Error(`Unknown argument: ${arg}`);
}
if (!archiveArgument) throw new Error('Usage: npm run release:smoke -- <archive.zip> [--offline]');

const archive = path.resolve(archiveArgument);
if (!fs.statSync(archive).isFile() || path.extname(archive).toLowerCase() !== '.zip') {
  throw new Error(`Not a release ZIP: ${archive}`);
}

const run = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd,
    encoding: options.encoding,
    env: options.env ?? process.env,
    shell: false,
    stdio: options.stdio ?? 'inherit',
  });
  if (result.error) throw result.error;
  return result;
};

const listing = run('unzip', ['-Z1', archive], { encoding: 'utf8', stdio: 'pipe' });
if (listing.status !== 0) throw new Error(listing.stderr || 'Unable to inspect release ZIP.');
const entries = listing.stdout.split(/\r?\n/u).filter(Boolean);
if (!entries.length) throw new Error('Release ZIP is empty.');
for (const entry of entries) {
  if (!entry.startsWith('naturalis-historia/') || entry.startsWith('/') || entry.split('/').includes('..') || entry.includes('\\')) {
    throw new Error(`Unsafe or unexpected archive path: ${entry}`);
  }
}
for (const forbidden of [
  '/.git/', '/.openai/', '/node_modules/', '/dist/', '/.next/', '/.vinext/', '/.wrangler/',
  '/assets-source/archive/', '/corpus-source/gutenberg/', '/experiments/narration/', '/outputs/',
  '/public/audio/', '/work/',
]) {
  if (entries.some((entry) => entry.includes(forbidden))) throw new Error(`Archive contains excluded path class: ${forbidden}`);
}
if (entries.some((entry) => /^naturalis-historia\/corpus-source\/[^/]+\.xml$/u.test(entry))) {
  throw new Error('Archive contains ignored raw corpus XML.');
}
const forbiddenRuntimePaths = [
  'naturalis-historia/app/api/narration/route.ts',
  'naturalis-historia/app/useNarrator.ts',
  'naturalis-historia/app/narration.mjs',
  'naturalis-historia/app/narration-provider.mjs',
  'naturalis-historia/app/narration-limiter.mjs',
  'naturalis-historia/app/narration-allowlist.json',
];
for (const forbidden of forbiddenRuntimePaths) {
  if (entries.includes(forbidden)) throw new Error(`Archive contains shelved narration runtime: ${forbidden}`);
}
const forbiddenSuffixes = ['.aac', '.db', '.der', '.flac', '.key', '.m4a', '.mp3', '.ogg', '.p12', '.pem', '.pfx', '.sqlite', '.sqlite3', '.tar', '.tgz', '.wav', '.zip'];
if (entries.some((entry) => forbiddenSuffixes.some((suffix) => entry.toLowerCase().endsWith(suffix)))) {
  throw new Error('Archive contains a forbidden credential, database, audio, or nested-archive file type.');
}
if (entries.some((entry) => /\/\.env(?:\.|$)/u.test(entry) && !entry.endsWith('/.env.example'))) {
  throw new Error('Archive contains a private environment file.');
}

const profileEntry = 'naturalis-historia/RELEASE-PROFILE.json';
if (!entries.includes(profileEntry)) throw new Error('Release ZIP lacks RELEASE-PROFILE.json.');
const profileResult = run('unzip', ['-p', archive, profileEntry], { encoding: 'utf8', stdio: 'pipe' });
if (profileResult.status !== 0) throw new Error('Unable to read RELEASE-PROFILE.json.');
const profile = JSON.parse(profileResult.stdout);
if (!['comprehensive-source', 'public-repo'].includes(profile.profile)) {
  throw new Error(`Unsupported source-archive profile: ${profile.profile}`);
}
if (!Number.isSafeInteger(profile.archiveCeilingBytes) || profile.archiveCeilingBytes <= 0) {
  throw new Error('Release profile has no valid archive ceiling.');
}
if (fs.statSync(archive).size > profile.archiveCeilingBytes) {
  throw new Error(`Release ZIP exceeds its declared ${profile.archiveCeilingBytes}-byte ceiling.`);
}
const expectedPackagingGates = [
  'scripts/verify-release-security.mjs',
  'scripts/verify-public-release.mjs',
  'scripts/audit-artwork-coverage.mjs',
];
if (
  profile.packagingPreflightPassed !== true
  || JSON.stringify(profile.packagingGateScripts) !== JSON.stringify(expectedPackagingGates)
  || profile.publicationGate !== 'not-evaluated-by-packager; run npm run release:check before deployment'
  || !['external-release-check-required', 'explicit-hold'].includes(profile.publicationStatus)
) {
  throw new Error('Release profile does not preserve the local-package/live-publication gate boundary.');
}
const holdEntry = 'naturalis-historia/RELEASE-HOLD.txt';
if ((profile.publicationStatus === 'explicit-hold') !== entries.includes(holdEntry)) {
  throw new Error('Release profile HOLD status and RELEASE-HOLD.txt do not agree.');
}
if (profile.profile === 'public-repo') {
  const materializedSourceSnapshot = profile.chapterSceneSourceSnapshot === 'materialized-and-excluded';
  const authenticatedPrebuiltSnapshot = profile.chapterSceneSourceSnapshot === 'absent-authenticated-public-repo';
  if (!materializedSourceSnapshot && !authenticatedPrebuiltSnapshot) {
    throw new Error('Public-repo profile lacks a recognized chapter-scene source-snapshot contract.');
  }
  if (materializedSourceSnapshot && (
    profile.excludedSourceAssetFileCount < 1
    || profile.excludedSourceAssetBytes < 1
    || !String(profile.sourceAssetManifest).endsWith('-source-assets.manifest.json')
    || !profile.excludedChapterSceneClasses.includes('accepted-master')
  )) {
    throw new Error('Public-repo profile lacks metadata for source assets excluded during this packaging run.');
  }
  if (authenticatedPrebuiltSnapshot && (
    profile.excludedSourceAssetFileCount !== 0
    || profile.excludedSourceAssetBytes !== 0
    || profile.sourceAssetManifest !== null
    || JSON.stringify(profile.excludedChapterSceneClasses) !== JSON.stringify([])
  )) {
    throw new Error('Authenticated prebuilt public-repo profile fabricates excluded source-asset metadata.');
  }
  if (entries.some((entry) => /^naturalis-historia\/assets-source\/chapter-scenes-v1\/.*\.png$/iu.test(entry))) {
    throw new Error('Public-repo archive contains a chapter-scene PNG preservation master.');
  }
  if (entries.some((entry) => entry.includes('/assets-source/chapter-scenes-v1/') && entry.includes('/evidence/'))) {
    throw new Error('Public-repo archive contains chapter-scene reject evidence.');
  }
  for (const retained of [
    'naturalis-historia/assets-source/chapter-scenes-provenance.json',
    'naturalis-historia/assets-source/chapter-artwork-manifest.json',
    'naturalis-historia/app/generated-chapter-scene-sources.mjs',
    'naturalis-historia/app/generated-chapter-scene-audit-sources.mjs',
  ]) {
    if (!entries.includes(retained)) throw new Error(`Public-repo archive omitted required generated metadata/code: ${retained}`);
  }
  if (!entries.some((entry) => /\/assets-source\/chapter-scenes-v1\/[^/]+\/receipt\.json$/u.test(entry))) {
    throw new Error('Public-repo archive omitted chapter-scene receipts.');
  }
  if (!entries.some((entry) => /\/public\/assets\/chapter-b\d{2}-(?:praef|c\d+)\.[0-9a-f]{8}\.w\d+\.(?:avif|webp|jpg)$/u.test(entry))) {
    throw new Error('Public-repo archive omitted generated chapter-scene derivatives.');
  }
}

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'naturalis-historia-smoke-'));
try {
  let result = run('unzip', ['-q', archive, '-d', temporary]);
  if (result.status !== 0) throw new Error('Unable to extract release ZIP.');
  const extracted = path.join(temporary, 'naturalis-historia');
  const manifestPath = path.join(extracted, 'RELEASE-MANIFEST.sha256');
  const manifestLines = fs.readFileSync(manifestPath, 'utf8').trim().split(/\r?\n/u);
  const declared = new Set();
  for (const line of manifestLines) {
    const match = line.match(/^([0-9a-f]{64})  (.+)$/u);
    if (!match) throw new Error(`Invalid release-manifest line: ${line}`);
    const relative = match[2];
    if (path.isAbsolute(relative) || relative.split('/').includes('..') || declared.has(relative)) {
      throw new Error(`Unsafe or duplicate release-manifest path: ${relative}`);
    }
    const target = path.join(extracted, relative);
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Manifest target is not a regular file: ${relative}`);
    const digest = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
    if (digest !== match[1]) throw new Error(`Release-manifest digest mismatch: ${relative}`);
    declared.add(relative);
  }
  const discovered = [];
  const stack = [extracted];
  while (stack.length) {
    const directory = stack.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Release archive contains a symbolic link: ${path.relative(extracted, absolute)}`);
      if (entry.isDirectory()) stack.push(absolute);
      else discovered.push(path.relative(extracted, absolute).split(path.sep).join('/'));
    }
  }
  for (const relative of discovered) {
    if (relative !== 'RELEASE-MANIFEST.sha256' && !declared.has(relative)) {
      throw new Error(`Archive file is absent from RELEASE-MANIFEST.sha256: ${relative}`);
    }
  }
  if (declared.size !== discovered.length - 1) throw new Error('Release manifest/file count mismatch.');

  const installArgs = ['ci'];
  if (offline) installArgs.push('--offline');
  result = run('npm', installArgs, { cwd: extracted });
  if (result.status !== 0) throw new Error('Fresh npm ci failed.');
  for (const command of [
    ['npm', ['run', 'test:release-security']],
    ['npm', ['run', 'test:public-release']],
    ['npm', ['run', 'audit:artwork-coverage']],
    ['npm', ['run', 'check']],
    ['npm', ['run', 'deploy:dry-run']],
  ]) {
    result = run(command[0], command[1], { cwd: extracted });
    if (result.status !== 0) throw new Error(`Extracted smoke failed: ${command[0]} ${command[1].join(' ')}`);
  }
  const auditRegistryText = fs.readFileSync(
    path.join(extracted, 'app', 'generated-chapter-scene-audit-sources.mjs'),
    'utf8',
  );
  const sampleDerivativeDigest = auditRegistryText.match(/"derivativeSha256":\s*\{[^}]*"[^"]+":\s*"([0-9a-f]{64})"/u)?.[1];
  if (!sampleDerivativeDigest) throw new Error('Audit-only chapter-scene registry lacks derivative SHA-256 receipts.');
  const clientChunkRoot = path.join(extracted, 'dist', 'client', '_next', 'static', 'chunks');
  const chunkDirectories = [clientChunkRoot];
  while (chunkDirectories.length) {
    const directory = chunkDirectories.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        chunkDirectories.push(absolute);
        continue;
      }
      if (!entry.name.endsWith('.js')) continue;
      const source = fs.readFileSync(absolute, 'utf8');
      if (
        source.includes('CHAPTER_SCENE_AUDIT_SOURCES')
        || source.includes('assets-source/chapter-scenes-v1/')
        || source.includes(sampleDerivativeDigest)
      ) {
        throw new Error(`Audit-only chapter-scene metadata leaked into a built client chunk: ${path.relative(extracted, absolute)}`);
      }
    }
  }
  console.log(`Verified fresh extracted release archive: ${archive}${offline ? ' (offline install)' : ''}`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
