import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

import { shardIdForToken } from '../app/search-index.mjs';
import { tokenizeSearchText } from '../app/search.mjs';
import { corpusBookUrl } from './corpus-path.mjs';

const SHARD_COUNT = 64;
const SCHEMA_VERSION = 1;
const corpusRoot = new URL('../public/corpus/', import.meta.url);
const manifestUrl = new URL('manifest.json', corpusRoot);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
delete manifest.searchIndex;

const sourceHash = createHash('sha256').update(`search-index:${SCHEMA_VERSION}:${SHARD_COUNT}\n`);
sourceHash.update(JSON.stringify(manifest));
const books = [];
for (const meta of manifest.books) {
  const text = await readFile(corpusBookUrl(meta, corpusRoot), 'utf8');
  sourceHash.update(text);
  books.push(JSON.parse(text));
}
const revision = sourceHash.digest('hex').slice(0, 16);

const documents = [];
const fields = [];
const shards = Array.from({ length: SHARD_COUNT }, () => new Map());

function addField(docId, kind, headingIndex, text) {
  const fieldId = fields.length;
  const fieldTokens = tokenizeSearchText(text);
  fields.push([docId, kind, headingIndex, fieldTokens.length]);
  const positionsByToken = new Map();
  fieldTokens.forEach((token, position) => {
    const positions = positionsByToken.get(token) ?? [];
    positions.push(position);
    positionsByToken.set(token, positions);
  });
  for (const [token, positions] of positionsByToken) {
    const shard = shards[shardIdForToken(token, SHARD_COUNT)];
    const postings = shard.get(token) ?? [];
    postings.push({ fieldId, positions });
    shard.set(token, postings);
  }
}

let ordinal = 0;
for (const book of books) {
  for (let chapterIndex = 0; chapterIndex < book.chapters.length; chapterIndex += 1) {
    const chapter = book.chapters[chapterIndex];
    const docId = ordinal++;
    const headings = chapter.englishChapters.map((heading) => [heading.number, heading.title]);
    documents.push([book.number, book.roman, chapterIndex, chapter.id, chapter.title, chapter.latinTitle, headings]);
    chapter.englishChapters.forEach((heading, headingIndex) => addField(docId, 0, headingIndex, heading.title));
    addField(docId, 1, -1, chapter.title);
    if (chapter.latinTitle) addField(docId, 2, -1, chapter.latinTitle);
    addField(docId, 3, -1, chapter.english);
    addField(docId, 4, -1, chapter.latin);
  }
}
if (documents.length !== manifest.totalChapters) {
  throw new Error(`Search index saw ${documents.length} chapters; manifest declares ${manifest.totalChapters}.`);
}

const searchRoot = new URL('search/', corpusRoot);
await rm(searchRoot, { recursive: true, force: true });
const revisionRoot = new URL(`${revision}/`, searchRoot);
await mkdir(revisionRoot, { recursive: true });

const catalog = { v: SCHEMA_VERSION, r: revision, s: SHARD_COUNT, d: documents, f: fields };
const catalogText = JSON.stringify(catalog);
await writeFile(new URL('catalog.json', revisionRoot), catalogText);

let shardRawBytes = 0;
let shardGzipBytes = 0;
for (let shardId = 0; shardId < SHARD_COUNT; shardId += 1) {
  const terms = {};
  for (const [token, postings] of [...shards[shardId].entries()].sort(([left], [right]) => left.localeCompare(right, 'en-US'))) {
    let priorFieldId = 0;
    terms[token] = postings.map(({ fieldId, positions }) => {
      const row = [fieldId - priorFieldId, positions[0]];
      priorFieldId = fieldId;
      for (let index = 1; index < positions.length; index += 1) row.push(positions[index] - positions[index - 1]);
      return row;
    });
  }
  const text = JSON.stringify({ v: SCHEMA_VERSION, r: revision, id: shardId, t: terms });
  shardRawBytes += Buffer.byteLength(text);
  shardGzipBytes += gzipSync(text).byteLength;
  await writeFile(new URL(`shard-${String(shardId).padStart(2, '0')}.json`, revisionRoot), text);
}

const { books: manifestBooks, ...manifestHead } = manifest;
const searchIndex = {
  version: SCHEMA_VERSION,
  revision,
  catalog: `/corpus/search/${revision}/catalog.json`,
  shardTemplate: `/corpus/search/${revision}/shard-{id}.json`,
  shardCount: SHARD_COUNT,
  hash: 'fnv1a32',
};
await writeFile(manifestUrl, `${JSON.stringify({ ...manifestHead, searchIndex, books: manifestBooks }, null, 2)}\n`);

console.log(
  `Built positional search ${revision}: ${documents.length.toLocaleString('en-US')} documents / `
  + `${fields.length.toLocaleString('en-US')} fields / ${shards.reduce((sum, shard) => sum + shard.size, 0).toLocaleString('en-US')} sharded terms / `
  + `${(Buffer.byteLength(catalogText) / 1024).toFixed(1)} KiB catalog / ${(shardRawBytes / 1024 / 1024).toFixed(2)} MiB raw shards / ${(shardGzipBytes / 1024 / 1024).toFixed(2)} MiB gzip shards`,
);
