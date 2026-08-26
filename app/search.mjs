export function normalizeSearchText(value) {
  return String(value)
    .replace(/[Ææ]/g, 'ae')
    .replace(/[Œœ]/g, 'oe')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('en-US');
}

export function tokenizeSearchText(value) {
  return normalizeSearchText(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function rangedWords(value) {
  return [...String(value).matchAll(/[\p{L}\p{N}]+/gu)].map((match) => ({
    value: tokenizeSearchText(match[0])[0] ?? '',
    start: match.index,
    end: match.index + match[0].length,
  })).filter((word) => word.value);
}

export function parseSearchTerms(query) {
  const terms = [];
  const normalizedQuotes = String(query).replace(/[“”]/g, '"');
  const matcher = /"([^"]+)"|(\S+)/g;
  for (const match of normalizedQuotes.matchAll(matcher)) {
    const raw = (match[1] ?? match[2]).trim();
    if (!raw) continue;
    const phrase = Boolean(match[1]);
    if (phrase) {
      const tokens = tokenizeSearchText(raw);
      if (tokens.length) terms.push({ raw, phrase: true, tokens });
      continue;
    }
    for (const token of tokenizeSearchText(raw)) terms.push({ raw: token, phrase: false, tokens: [token] });
  }
  return terms.filter((term, index, all) => all.findIndex((candidate) => candidate.phrase === term.phrase && candidate.tokens.join(' ') === term.tokens.join(' ')) === index);
}

export function searchIsReady(query) {
  return parseSearchTerms(query).flatMap((term) => term.tokens).join('').length >= 2;
}

export function findSearchRanges(text, query) {
  const haystack = rangedWords(text);
  const ranges = [];
  for (const term of parseSearchTerms(query)) {
    for (let index = 0; index <= haystack.length - term.tokens.length; index += 1) {
      if (!term.tokens.every((token, offset) => haystack[index + offset].value === token)) continue;
      ranges.push({
        index: haystack[index].start,
        length: haystack[index + term.tokens.length - 1].end - haystack[index].start,
      });
    }
  }
  ranges.sort((a, b) => a.index - b.index || b.length - a.length);
  const kept = [];
  for (const range of ranges) {
    if (kept.some((prior) => range.index < prior.index + prior.length)) continue;
    kept.push(range);
  }
  return kept;
}

export function analyzeSearchText(text, query) {
  const haystack = tokenizeSearchText(text);
  const terms = parseSearchTerms(query);
  if (!terms.length) return { matches: false, earliest: Number.POSITIVE_INFINITY, span: Number.POSITIVE_INFINITY, contiguous: false };

  const windows = [];
  for (const term of terms) {
    const width = term.tokens.length;
    const hits = [];
    for (let index = 0; index <= haystack.length - width; index += 1) {
      if (term.tokens.every((token, offset) => haystack[index + offset] === token)) hits.push([index, index + width - 1]);
    }
    if (!hits.length) return { matches: false, earliest: Number.POSITIVE_INFINITY, span: Number.POSITIVE_INFINITY, contiguous: false };
    windows.push(hits);
  }

  let bestStart = 0;
  let bestEnd = Number.POSITIVE_INFINITY;
  const visit = (termIndex, start, end) => {
    if (termIndex === windows.length) {
      if (end - start < bestEnd - bestStart || (end - start === bestEnd - bestStart && start < bestStart)) {
        bestStart = start;
        bestEnd = end;
      }
      return;
    }
    for (const [hitStart, hitEnd] of windows[termIndex]) {
      const nextStart = termIndex === 0 ? hitStart : Math.min(start, hitStart);
      const nextEnd = termIndex === 0 ? hitEnd : Math.max(end, hitEnd);
      if (nextEnd - nextStart > bestEnd - bestStart) continue;
      visit(termIndex + 1, nextStart, nextEnd);
    }
  };
  visit(0, 0, 0);
  const queryTokens = terms.flatMap((term) => term.tokens);
  const contiguous = haystack.some((_, index) => queryTokens.every((token, offset) => haystack[index + offset] === token));
  return { matches: true, earliest: bestStart, span: bestEnd - bestStart + 1, contiguous };
}

export function scoreSearchField(text, query, baseScore) {
  const analysis = analyzeSearchText(text, query);
  if (!analysis.matches) return Number.POSITIVE_INFINITY;
  return baseScore
    - (analysis.contiguous ? 24 : 0)
    + Math.min(60, analysis.span * 2)
    + Math.min(20, analysis.earliest / 80);
}
