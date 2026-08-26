import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

export const RELEASE_PROFILES = Object.freeze({
  COMPREHENSIVE_SOURCE: 'comprehensive-source',
  PUBLIC_REPO: 'public-repo',
  SOURCE_ASSETS: 'source-assets',
});

export const GITHUB_RELEASE_ASSET_CEILING_BYTES = 2 * 1024 * 1024 * 1024;
export const PORTABLE_ARCHIVE_CEILING_BYTES = 1_500_000_000;
export const SOURCE_ASSET_PART_TARGET_BYTES = 1_350_000_000;
export const COMPREHENSIVE_ARCHIVE_CEILING_BYTES = 8_000_000_000;
export const NORMALIZED_TIME = new Date('2026-08-26T00:00:00.000Z');
export const ARCHIVE_PREFIX = 'naturalis-historia';

const chapterScenePrefix = 'assets-source/chapter-scenes-v1/';
const excludedPrefixes = [
  '.git/', '.next/', '.openai/', '.pytest_cache/', '.venv/', '.venv-corpus/', '.vinext/', '.wrangler/', 'assets-source/archive/',
  'corpus-source/gutenberg/', 'dist/', 'experiments/narration/', 'node_modules/', 'outputs/',
  'public/audio/', 'work/',
];
const excludedExact = new Set([
  '.DS_Store',
  '.netrc',
  '.npmrc',
  'RELEASE-HOLD.txt',
  'RELEASE-MANIFEST.sha256',
  'RELEASE-PROFILE.json',
]);
const excludedSuffixes = [
  '.aac', '.db', '.der', '.flac', '.key', '.log', '.m4a', '.mp3', '.ogg', '.p12', '.pem',
  '.pfx', '.pyc', '.pyo', '.sqlite', '.sqlite3', '.tar', '.tgz', '.wav', '.zip',
];

export const toPosixPath = (value) => value.split(path.sep).join('/');

export const assertSafeRelativePath = (relative) => {
  const segments = typeof relative === 'string' ? relative.split('/') : [];
  if (
    typeof relative !== 'string'
    || !relative
    || path.isAbsolute(relative)
    || relative.includes('\\')
    || relative.includes('\0')
    || relative.includes('\n')
    || relative.includes('\r')
    || segments.some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error(`Unsafe release path: ${JSON.stringify(relative)}`);
  }
  return relative;
};

export const classifyChapterSceneAsset = (relative) => {
  if (!relative.startsWith(chapterScenePrefix)) return null;
  if (relative.includes('/evidence/')) return 'reject-evidence';
  if (relative.toLowerCase().endsWith('.png')) return 'accepted-master';
  return null;
};

export const includeReleasePath = (relative, profile = RELEASE_PROFILES.COMPREHENSIVE_SOURCE) => {
  assertSafeRelativePath(relative);
  if (excludedExact.has(relative) || excludedPrefixes.some((prefix) => relative.startsWith(prefix)) || relative.includes('/__pycache__/')) return false;
  if (relative.startsWith('.env') && relative !== '.env.example') return false;
  if (/^corpus-source\/[^/]+\.xml$/u.test(relative)) return false;
  if (excludedSuffixes.some((suffix) => relative.toLowerCase().endsWith(suffix))) return false;
  if (profile === RELEASE_PROFILES.PUBLIC_REPO && classifyChapterSceneAsset(relative)) return false;
  if (profile !== RELEASE_PROFILES.COMPREHENSIVE_SOURCE && profile !== RELEASE_PROFILES.PUBLIC_REPO) {
    throw new Error(`Release-path selection is not defined for profile: ${profile}`);
  }
  return true;
};

const snapshotStat = (absolute) => {
  const stat = fs.lstatSync(absolute, { bigint: true });
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Release source must be a regular, non-symbolic file: ${absolute}`);
  }
  if (stat.size > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`Release source is too large to size safely: ${absolute}`);
  return {
    device: stat.dev.toString(),
    inode: stat.ino.toString(),
    mode: Number(stat.mode & 0o777n),
    mtimeNs: stat.mtimeNs.toString(),
    size: Number(stat.size),
  };
};

export const captureSnapshot = (root, relative) => {
  assertSafeRelativePath(relative);
  return { relative, ...snapshotStat(path.join(root, relative)) };
};

const snapshotMetadataMatches = (expected, actual) => (
  expected.device === actual.device
  && expected.inode === actual.inode
  && expected.mode === actual.mode
  && expected.mtimeNs === actual.mtimeNs
  && expected.size === actual.size
);

export const assertSnapshotMetadata = (root, snapshot) => {
  const current = snapshotStat(path.join(root, snapshot.relative));
  if (!snapshotMetadataMatches(snapshot, current)) {
    throw new Error(`Release source changed during packaging: ${snapshot.relative}`);
  }
};

export const hashFile = async (absolute) => {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(absolute)) hash.update(chunk);
  return hash.digest('hex');
};

export const copyAndHashSnapshot = async (root, snapshot, destination) => {
  assertSnapshotMetadata(root, snapshot);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const hash = crypto.createHash('sha256');
  const hasher = new Transform({
    transform(chunk, encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  await pipeline(
    fs.createReadStream(path.join(root, snapshot.relative)),
    hasher,
    fs.createWriteStream(destination, { flags: 'wx', mode: snapshot.mode }),
  );
  assertSnapshotMetadata(root, snapshot);
  const staged = fs.lstatSync(destination);
  if (!staged.isFile() || staged.isSymbolicLink() || staged.size !== snapshot.size) {
    throw new Error(`Staged release file does not match its source size: ${snapshot.relative}`);
  }
  fs.chmodSync(destination, snapshot.mode);
  fs.utimesSync(destination, NORMALIZED_TIME, NORMALIZED_TIME);
  return hash.digest('hex');
};

export const verifySnapshotDigest = async (root, snapshot, expectedDigest) => {
  assertSnapshotMetadata(root, snapshot);
  const digest = await hashFile(path.join(root, snapshot.relative));
  assertSnapshotMetadata(root, snapshot);
  if (digest !== expectedDigest) throw new Error(`Release source bytes changed during packaging: ${snapshot.relative}`);
};

export const assertSamePathSet = (expected, actual, label = 'release source') => {
  const left = [...expected].sort((a, b) => a.localeCompare(b, 'en'));
  const right = [...actual].sort((a, b) => a.localeCompare(b, 'en'));
  if (left.length !== right.length || left.some((entry, index) => entry !== right[index])) {
    const expectedSet = new Set(left);
    const actualSet = new Set(right);
    const added = right.filter((entry) => !expectedSet.has(entry)).slice(0, 5);
    const removed = left.filter((entry) => !actualSet.has(entry)).slice(0, 5);
    throw new Error(`${label} file set changed during packaging (added: ${added.join(', ') || 'none'}; removed: ${removed.join(', ') || 'none'}).`);
  }
};

export const enumerateSourceAssetPaths = (root, { allowEmpty = false } = {}) => {
  const base = path.join(root, chapterScenePrefix);
  if (!fs.existsSync(base)) {
    if (allowEmpty) return [];
    throw new Error('No chapter-scene source assets were found.');
  }
  const selected = [];
  const stack = [base];
  while (stack.length) {
    const directory = stack.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = toPosixPath(path.relative(root, absolute));
      if (entry.isSymbolicLink()) throw new Error(`Source-asset tree contains a symbolic link: ${relative}`);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (!entry.isFile()) throw new Error(`Source-asset tree contains a non-file entry: ${relative}`);
      if (!classifyChapterSceneAsset(relative)) continue;
      assertSafeRelativePath(relative);
      if (excludedExact.has(relative) || excludedSuffixes.some((suffix) => relative.toLowerCase().endsWith(suffix))) {
        throw new Error(`Excluded or unsafe file type found among source assets: ${relative}`);
      }
      selected.push(relative);
    }
  }
  selected.sort((left, right) => left.localeCompare(right, 'en'));
  if (!selected.length && !allowEmpty) throw new Error('No chapter-scene source assets were found.');
  return selected;
};

const partitionSnapshots = (snapshots) => {
  const parts = [];
  let current = [];
  let currentBytes = 0;
  for (const snapshot of snapshots) {
    if (snapshot.size > PORTABLE_ARCHIVE_CEILING_BYTES - 50_000_000) {
      throw new Error(`Source asset is too large for a safe release-asset part: ${snapshot.relative}`);
    }
    if (current.length && currentBytes + snapshot.size > SOURCE_ASSET_PART_TARGET_BYTES) {
      parts.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(snapshot);
    currentBytes += snapshot.size;
  }
  if (current.length) parts.push(current);
  return parts;
};

export const planSourceAssetBundles = (snapshots, version, hold = false) => {
  const byCategory = new Map([
    ['accepted-master', []],
    ['reject-evidence', []],
  ]);
  for (const snapshot of snapshots) {
    const category = classifyChapterSceneAsset(snapshot.relative);
    if (!byCategory.has(category)) throw new Error(`Unclassified source asset: ${snapshot.relative}`);
    byCategory.get(category).push(snapshot);
  }
  const label = hold ? `naturalis-historia-${version}-HOLD` : `naturalis-historia-${version}`;
  const categorySlugs = {
    'accepted-master': 'accepted-masters',
    'reject-evidence': 'reject-evidence',
  };
  const bundles = [];
  for (const [category, unsorted] of byCategory) {
    const sorted = [...unsorted].sort((left, right) => left.relative.localeCompare(right.relative, 'en'));
    const parts = partitionSnapshots(sorted);
    const width = Math.max(3, String(parts.length).length);
    parts.forEach((entries, index) => {
      const part = String(index + 1).padStart(width, '0');
      const total = String(parts.length).padStart(width, '0');
      const id = `${categorySlugs[category]}.part-${part}-of-${total}`;
      bundles.push({
        archive: `${label}-source-assets-${id}.zip`,
        category,
        entries,
        id,
        sourceBytes: entries.reduce((sum, entry) => sum + entry.size, 0),
      });
    });
  }
  const assigned = bundles.flatMap((bundle) => bundle.entries.map((entry) => entry.relative));
  assertSamePathSet(snapshots.map((snapshot) => snapshot.relative), assigned, 'source-asset bundle plan');
  return bundles;
};

export const assertArchiveSizeWithinLimit = (archive, ceilingBytes) => {
  const stat = fs.lstatSync(archive);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Archive output is not a regular file: ${archive}`);
  if (stat.size > ceilingBytes) {
    throw new Error(`Archive exceeds its ${ceilingBytes}-byte ceiling (${stat.size} bytes): ${archive}`);
  }
  return stat.size;
};

export const normalizeDirectoryTimes = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) normalizeDirectoryTimes(path.join(directory, entry.name));
  }
  fs.utimesSync(directory, NORMALIZED_TIME, NORMALIZED_TIME);
};

export const writeNormalizedJson = (absolute, value) => {
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  fs.utimesSync(absolute, NORMALIZED_TIME, NORMALIZED_TIME);
};

export const sha256Text = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const withTemporaryDirectory = async (prefix, callback) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    return await callback(temporary);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
};
