import { parseSearchTerms } from './search.mjs';

const FIELD_BASE_SCORES = [0, 12, 70, 200, 300];

export function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function shardIdForToken(token, shardCount) {
  return fnv1a32(token) % shardCount;
}

export function requiredShardIds(query, shardCount) {
  return [...new Set(parseSearchTerms(query)
    .flatMap((term) => term.tokens)
    .map((token) => shardIdForToken(token, shardCount)))]
    .sort((left, right) => left - right);
}

export function decodePostingRows(rows) {
  const decoded = new Map();
  let fieldId = 0;
  for (const row of rows ?? []) {
    fieldId += row[0];
    let position = row[1];
    const positions = [position];
    for (let index = 2; index < row.length; index += 1) {
      position += row[index];
      positions.push(position);
    }
    decoded.set(fieldId, positions);
  }
  return decoded;
}

function phraseWindows(term, postingsByToken, fieldId) {
  const first = postingsByToken.get(term.tokens[0])?.get(fieldId);
  if (!first) return [];
  if (term.tokens.length === 1) return first.map((position) => [position, position]);
  const following = term.tokens.slice(1).map((token) => new Set(postingsByToken.get(token)?.get(fieldId) ?? []));
  return first
    .filter((position) => following.every((positions, offset) => positions.has(position + offset + 1)))
    .map((position) => [position, position + term.tokens.length - 1]);
}

function bestCover(windows) {
  const pointers = windows.map(() => 0);
  let bestStart = 0;
  let bestEnd = Number.POSITIVE_INFINITY;
  while (windows.every((list, index) => pointers[index] < list.length)) {
    const selected = windows.map((list, index) => list[pointers[index]]);
    let earliestIndex = 0;
    for (let index = 1; index < selected.length; index += 1) {
      if (selected[index][0] < selected[earliestIndex][0]
        || (selected[index][0] === selected[earliestIndex][0] && selected[index][1] < selected[earliestIndex][1])) earliestIndex = index;
    }
    const start = Math.min(...selected.map((range) => range[0]));
    const end = Math.max(...selected.map((range) => range[1]));
    if (end - start < bestEnd - bestStart || (end - start === bestEnd - bestStart && start < bestStart)) {
      bestStart = start;
      bestEnd = end;
    }
    pointers[earliestIndex] += 1;
  }
  return { earliest: bestStart, span: bestEnd - bestStart + 1 };
}

function queryIsContiguous(terms, postingsByToken, fieldId) {
  const tokens = terms.flatMap((term) => term.tokens);
  const first = postingsByToken.get(tokens[0])?.get(fieldId);
  if (!first) return false;
  const following = tokens.slice(1).map((token) => new Set(postingsByToken.get(token)?.get(fieldId) ?? []));
  return first.some((position) => following.every((positions, offset) => positions.has(position + offset + 1)));
}

function resultForField(catalog, fieldId, analysis) {
  const [docId, kind, headingIndex] = catalog.f[fieldId];
  const [bookNumber, roman, chapterIndex, chapterId, englishTitle, latinTitle, headings] = catalog.d[docId];
  const heading = kind === 0 ? headings[headingIndex] : undefined;
  const title = heading?.[1] ?? (kind === 2 ? latinTitle : englishTitle);
  const field = kind === 2 || kind === 4 ? 'la' : 'en';
  const descriptor = kind <= 2
    ? `${field === 'la' ? 'Latin' : 'English'} heading match · open this chapter in context`
    : `${field === 'la' ? 'Latin' : 'English'} passage match · near word ${analysis.earliest + 1} · open in context`;
  return {
    key: `${bookNumber}:${chapterId}`,
    ordinal: docId,
    bookNumber,
    roman,
    chapterIndex,
    chapterId,
    title,
    field,
    excerpt: descriptor,
    wordPosition: kind >= 3 ? analysis.earliest : undefined,
    score: FIELD_BASE_SCORES[kind]
      - (analysis.contiguous ? 24 : 0)
      + Math.min(60, analysis.span * 2)
      + Math.min(20, analysis.earliest / 80),
    englishChapterNumber: heading?.[0],
  };
}

export function searchPositionalIndex(catalog, shards, query) {
  const terms = parseSearchTerms(query);
  if (!terms.length) return [];
  const tokens = [...new Set(terms.flatMap((term) => term.tokens))];
  const shardById = new Map(shards.map((shard) => [shard.id, shard]));
  const postingsByToken = new Map();
  for (const token of tokens) {
    const shard = shardById.get(shardIdForToken(token, catalog.s));
    const rows = shard?.t?.[token];
    if (!rows) return [];
    postingsByToken.set(token, decodePostingRows(rows));
  }

  const firstTokenFields = postingsByToken.get(tokens[0]);
  const bestByDocument = new Map();
  for (const fieldId of firstTokenFields.keys()) {
    const windows = terms.map((term) => phraseWindows(term, postingsByToken, fieldId));
    if (windows.some((hits) => hits.length === 0)) continue;
    const cover = bestCover(windows);
    const result = resultForField(catalog, fieldId, {
      ...cover,
      contiguous: queryIsContiguous(terms, postingsByToken, fieldId),
    });
    const prior = bestByDocument.get(result.ordinal);
    if (!prior || result.score < prior.score) bestByDocument.set(result.ordinal, result);
  }
  return [...bestByDocument.values()].sort((left, right) => left.score - right.score || left.ordinal - right.ordinal);
}
