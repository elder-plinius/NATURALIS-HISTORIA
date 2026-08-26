import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

import { corpusBookUrl } from './corpus-path.mjs';

const root = new URL('../public/corpus/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const releaseMaterial = [];

for (const meta of manifest.books) {
  const match = /^\/corpus\/book-(\d{2})\.([0-9a-f]{16})\.json$/.exec(meta.file);
  assert(match, `Book ${meta.number} has a non-versioned path`);
  assert(Number(match[1]) === meta.number, `Book ${meta.number} path is misnumbered`);
  const bytes = await readFile(corpusBookUrl(meta, root));
  const digest = createHash('sha256').update(bytes).digest('hex');
  assert(digest === meta.sha256, `Book ${meta.number} manifest digest is stale`);
  assert(match[2] === digest.slice(0, 16), `Book ${meta.number} filename digest is stale`);
  assert(bytes.byteLength === meta.byteLength, `Book ${meta.number} byte length is stale`);
  releaseMaterial.push(digest);
}

const corrections = await readFile(new URL(manifest.corrections.file.replace('/corpus/', ''), root));
const correctionDigest = createHash('sha256').update(corrections).digest('hex');
assert(correctionDigest === manifest.corrections.sha256, 'Correction-ledger digest is stale');
releaseMaterial.push(
  correctionDigest,
  manifest.sources.latin.sha256,
  manifest.sources.latin.authority.sha256,
  ...manifest.sources.english.map((source) => source.sha256),
);
const expectedRevision = createHash('sha256')
  .update(releaseMaterial.join('\n'))
  .digest('hex')
  .slice(0, 16);
assert(manifest.revision === expectedRevision, 'Corpus release revision is stale');

const staleBooks = (await readdir(root)).filter((name) =>
  /^book-\d{2}\.json$/.test(name) ||
  (/^book-\d{2}\.[0-9a-f]{16}\.json$/.test(name) && !manifest.books.some((book) => book.file.endsWith(`/${name}`)))
);
assert(staleBooks.length === 0, `Stale corpus payloads remain: ${staleBooks.join(', ')}`);

console.log(`Verified ${manifest.books.length} immutable corpus books at release ${manifest.revision}`);
