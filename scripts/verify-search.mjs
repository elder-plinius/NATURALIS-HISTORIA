import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

import { decodePostingRows, requiredShardIds, searchPositionalIndex, shardIdForToken } from '../app/search-index.mjs';
import { analyzeSearchText, findSearchRanges, parseSearchTerms, scoreSearchField, searchIsReady } from '../app/search.mjs';
import { corpusBookUrl } from './corpus-path.mjs';

assert.equal(searchIsReady('a'), false);
assert.equal(searchIsReady('ants'), true);
assert.deepEqual(parseSearchTerms('elephant "amber islands" elephant').map((term) => term.tokens.join(' ')), ['elephant', 'amber islands']);
assert.equal(analyzeSearchText('INFANTS AND CHILDREN', 'ants').matches, false);
assert.equal(analyzeSearchText('ELEPHANTS; THEIR CAPACITY', 'ants').matches, false);
assert.equal(analyzeSearchText('ANTS AND THEIR COLONIES', 'ants').matches, true);
assert.equal(analyzeSearchText('The Æthiopian islands', 'aethiopian islands').matches, true);
assert.equal(analyzeSearchText('amber islands in the northern sea', '"amber islands"').matches, true);
assert.deepEqual(findSearchRanges('INFANTS, then ants and more ants.', 'ants'), [
  { index: 14, length: 4 },
  { index: 28, length: 4 },
]);
assert.deepEqual(findSearchRanges('The Æthiopian islands', '"aethiopian islands"'), [{ index: 4, length: 17 }]);
assert.ok(scoreSearchField('ANTS', 'ants', 0) < scoreSearchField('A long passage about ants', 'ants', 200));
assert.ok(scoreSearchField('ants live in colonies', 'ants colonies', 200) < scoreSearchField(`ants ${'far '.repeat(40)}colonies`, 'ants colonies', 200));

const corpusRoot = new URL('../public/corpus/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', corpusRoot), 'utf8'));
const indexMeta = manifest.searchIndex;
assert.equal(indexMeta.version, 1);
assert.equal(indexMeta.hash, 'fnv1a32');
assert.equal(indexMeta.shardCount, 64);

const catalogUrl = new URL(indexMeta.catalog.replace('/corpus/', ''), corpusRoot);
const catalogText = await readFile(catalogUrl, 'utf8');
const catalog = JSON.parse(catalogText);
assert.equal(catalog.v, indexMeta.version);
assert.equal(catalog.r, indexMeta.revision);
assert.equal(catalog.s, indexMeta.shardCount);
assert.equal(catalog.d.length, manifest.totalChapters);
assert.ok(gzipSync(catalogText).byteLength < 100 * 1024, 'Search catalog exceeds 100 KiB gzip');

const books = [];
let ordinal = 0;
for (const meta of manifest.books) {
  const book = JSON.parse(await readFile(corpusBookUrl(meta, corpusRoot), 'utf8'));
  books.push(book);
  book.chapters.forEach((chapter, chapterIndex) => {
    const doc = catalog.d[ordinal];
    assert.deepEqual(doc.slice(0, 4), [book.number, book.roman, chapterIndex, chapter.id]);
    ordinal += 1;
  });
}

const allShards = [];
let shardGzipBytes = 0;
for (let shardId = 0; shardId < indexMeta.shardCount; shardId += 1) {
  const path = indexMeta.shardTemplate.replace('/corpus/', '').replace('{id}', String(shardId).padStart(2, '0'));
  const text = await readFile(new URL(path, corpusRoot), 'utf8');
  const compressed = gzipSync(text).byteLength;
  assert.ok(compressed < 125 * 1024, `Search shard ${shardId} exceeds 125 KiB gzip`);
  shardGzipBytes += compressed;
  const shard = JSON.parse(text);
  assert.equal(shard.v, indexMeta.version);
  assert.equal(shard.r, indexMeta.revision);
  assert.equal(shard.id, shardId);
  for (const [token, rows] of Object.entries(shard.t)) {
    assert.equal(shardIdForToken(token, indexMeta.shardCount), shardId, `${token} is in the wrong shard`);
    for (const [fieldId, positions] of decodePostingRows(rows)) {
      assert.ok(fieldId >= 0 && fieldId < catalog.f.length, `${token} points outside the field catalog`);
      const tokenCount = catalog.f[fieldId][3];
      assert.ok(positions.every((position, index) => position >= 0 && position < tokenCount && (index === 0 || position > positions[index - 1])), `${token} has invalid positions`);
    }
  }
  allShards.push(shard);
}
assert.ok(shardGzipBytes < 4.2 * 1024 * 1024, 'Complete concordance exceeds 4.2 MiB gzip');

function sourceSearch(query) {
  const results = [];
  let docId = 0;
  for (const book of books) {
    for (let chapterIndex = 0; chapterIndex < book.chapters.length; chapterIndex += 1) {
      const chapter = book.chapters[chapterIndex];
      let score = Number.POSITIVE_INFINITY;
      let field = 'en';
      let title = chapter.title;
      let englishChapterNumber;
      chapter.englishChapters.forEach((heading) => {
        const candidate = scoreSearchField(heading.title, query, 0);
        if (candidate < score) {
          score = candidate;
          title = heading.title;
          englishChapterNumber = heading.number;
        }
      });
      const englishTitleScore = scoreSearchField(chapter.title, query, 12);
      if (englishTitleScore < score) {
        score = englishTitleScore;
        title = chapter.title;
        englishChapterNumber = undefined;
      }
      const latinTitleScore = scoreSearchField(chapter.latinTitle, query, 70);
      if (latinTitleScore < score) {
        score = latinTitleScore;
        field = 'la';
        title = chapter.latinTitle;
        englishChapterNumber = undefined;
      }
      const englishBodyScore = scoreSearchField(chapter.english, query, 200);
      if (englishBodyScore < score) {
        score = englishBodyScore;
        field = 'en';
      }
      const latinBodyScore = scoreSearchField(chapter.latin, query, 300);
      if (latinBodyScore < score) {
        score = latinBodyScore;
        field = 'la';
      }
      if (Number.isFinite(score)) results.push({ key: `${book.number}:${chapter.id}`, score, field, title, englishChapterNumber, ordinal: docId });
      docId += 1;
    }
  }
  return results.sort((left, right) => left.score - right.score || left.ordinal - right.ordinal);
}

for (const query of ['ants', 'elephant memory', '"amber islands"', '"the elephant"', 'aethiopian islands', 'religio siderum', 'nature']) {
  const shardIds = requiredShardIds(query, indexMeta.shardCount);
  const indexed = searchPositionalIndex(catalog, shardIds.map((id) => allShards[id]), query);
  const source = sourceSearch(query);
  assert.deepEqual(
    indexed.map(({ key, score, field, title, englishChapterNumber }) => ({ key, score, field, title, englishChapterNumber })),
    source.map(({ key, score, field, title, englishChapterNumber }) => ({ key, score, field, title, englishChapterNumber })),
    `Indexed ranking drifted for ${query}`,
  );
}
assert.ok(sourceSearch('"the elephant"').length > 0, 'The exact-phrase search suggestion must produce results');
const latinPassageQuery = 'religio siderum';
const latinPassageShardIds = requiredShardIds(latinPassageQuery, indexMeta.shardCount);
const latinPassageResult = searchPositionalIndex(catalog, latinPassageShardIds.map((id) => allShards[id]), latinPassageQuery)[0];
assert.equal(latinPassageResult.field, 'la');
assert.ok(Number.isInteger(latinPassageResult.wordPosition) && latinPassageResult.wordPosition >= 0, 'Passage results must retain their indexed landing position');

console.log(
  `Verified exact positional search parity across ${catalog.d.length.toLocaleString('en-US')} documents / `
  + `${catalog.f.length.toLocaleString('en-US')} fields / ${indexMeta.shardCount} bounded concordance leaves with language-aware passage landing`,
);
