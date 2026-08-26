export function corpusBookUrl(meta, corpusRoot) {
  const match = /^\/corpus\/(book-\d{2}\.[0-9a-f]{16}\.json)$/.exec(meta?.file ?? '');
  if (!match) throw new Error(`Unsafe or unversioned corpus book path: ${meta?.file ?? '<missing>'}`);
  return new URL(match[1], corpusRoot);
}

export function corpusBookMeta(manifest, bookNumber) {
  const meta = manifest.books.find((book) => book.number === bookNumber);
  if (!meta) throw new Error(`Corpus manifest has no Book ${bookNumber}`);
  return meta;
}
