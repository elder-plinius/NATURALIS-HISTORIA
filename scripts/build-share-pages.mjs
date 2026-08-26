import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chapterIllustration } from '../app/illustrations.mjs';
import policy from '../edition-policy.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const readRoot = path.join(publicRoot, 'read');
const origin = policy.origin;
const manifest = JSON.parse(await readFile(path.join(publicRoot, 'corpus', 'manifest.json'), 'utf8'));
const readingCssRevision = createHash('sha256')
  .update(await readFile(path.join(publicRoot, 'reading-leaf.css')))
  .digest('hex')
  .slice(0, 10);
const readingJsRevision = createHash('sha256')
  .update(await readFile(path.join(publicRoot, 'reading-leaf.js')))
  .digest('hex')
  .slice(0, 10);

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');
const paragraphs = (text, language) => String(text).split(/\n{2,}/).filter(Boolean).map((paragraph) => `<p lang="${language}">${escapeHtml(paragraph)}</p>`).join('\n');
const summary = (text) => {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  return normalized.length > 190 ? `${normalized.slice(0, 189).trimEnd()}…` : normalized;
};

const records = [];
let ordinal = 0;
for (const meta of manifest.books) {
  const book = JSON.parse(await readFile(path.join(publicRoot, meta.file.replace(/^\//, '')), 'utf8'));
  book.chapters.forEach((chapter, chapterIndex) => {
    records.push({ book, chapter, chapterIndex, ordinal: ordinal++ });
  });
}
if (records.length !== manifest.totalChapters) throw new Error('Share-page record count does not match the corpus manifest.');

await rm(readRoot, { recursive: true, force: true });
const urls = ['/', '/catalogue', '/edition', '/privacy', '/afterword/vesuvius'];
let totalBytes = 0;

for (let index = 0; index < records.length; index += 1) {
  const { book, chapter, ordinal: chapterOrdinal } = records[index];
  const encodedId = encodeURIComponent(chapter.id);
  const pathname = `/read/${book.number}/${encodedId}.html`;
  const canonical = `${origin}${pathname}`;
  const interactive = `/?book=${book.number}&section=${encodeURIComponent(chapter.id)}`;
  const illustration = chapterIllustration({
    bookNumber: book.number,
    bookRoman: book.roman,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
  });
  const sceneSource = illustration.panels?.[0]?.source;
  if (sceneSource?.viewerKind !== 'chapter-scene' || !sceneSource.viewerImage || !sceneSource.viewerPreferredImage) {
    throw new Error(`Missing standalone share-page scene for ${book.number}:${chapter.id}`);
  }
  const shareImage = {
    fallback: sceneSource.viewerImage,
    avif: sceneSource.viewerPreferredImage,
    width: 1536,
    height: 1024,
    socialWidth: 1024,
    socialHeight: 683,
  };
  const description = summary(chapter.english);
  const shareTitle = `${chapter.title} — Book ${book.roman} — ${policy.siteName}`;
  const shareImageAlt = `${chapter.title} — Book ${book.roman}, in ${policy.siteName}`;
  const prior = records[index - 1];
  const next = records[index + 1];
  const adjacentLink = (record, label) => record
    ? `<a href="/read/${record.book.number}/${encodeURIComponent(record.chapter.id)}.html">${label}<span>Book ${record.book.roman} · ${escapeHtml(record.chapter.title)}</span></a>`
    : '<span></span>';
  const nextLink = next
    ? adjacentLink(next, 'Next leaf →')
    : '<a href="/afterword/vesuvius">Afterword →<span>Pliny the Younger · Two Letters from Vesuvius</span></a>';
  const historicalNotice = book.number >= 20 && book.number <= 32
    ? '<aside class="content-note"><strong>Historical remedies—not medical advice.</strong> This book contains obsolete and potentially dangerous practices. <a href="/edition#content-notice">Read the full content notice.</a></aside>'
    : '';
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Chapter',
    name: chapter.title,
    position: chapterOrdinal + 1,
    author: { '@type': 'Person', name: 'Pliny the Elder' },
    editor: { '@type': 'Person', name: 'Karl Friedrich Theodor Mayhoff' },
    translator: [
      { '@type': 'Person', name: 'John Bostock' },
      { '@type': 'Person', name: 'H. T. Riley' },
    ],
    inLanguage: ['la', 'en'],
    isPartOf: { '@type': 'Book', name: 'Naturalis Historia', author: { '@type': 'Person', name: 'Pliny the Elder' } },
    isBasedOn: [manifest.sources.latin.url, ...manifest.sources.english.map((source) => source.url)],
    image: `${origin}${shareImage.fallback}`,
    url: canonical,
  }).replaceAll('<', '\\u003c');
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="${policy.publicIndexing ? 'index,follow' : 'noindex,nofollow,noarchive'}">
  <title>${escapeHtml(shareTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/reading-leaf.css?v=${readingCssRevision}">
  <script src="/reading-leaf.js?v=${readingJsRevision}" defer></script>
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="${escapeHtml(policy.siteName)}">
  <meta property="og:title" content="${escapeHtml(shareTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${origin}${shareImage.fallback}">
  <meta property="og:image:width" content="${shareImage.socialWidth}">
  <meta property="og:image:height" content="${shareImage.socialHeight}">
  <meta property="og:image:alt" content="${escapeHtml(shareImageAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(shareTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${origin}${shareImage.fallback}">
  <meta name="twitter:image:alt" content="${escapeHtml(shareImageAlt)}">
  <script type="application/ld+json">${structuredData}</script>
</head>
<body>
  <header class="leaf-bar"><a href="/catalogue">☷ All XXXVII books</a><a class="living-link" href="${escapeHtml(interactive)}">Enter the Living Codex ↗</a></header>
  <main>
    <article class="reading-leaf">
      <header class="leaf-title"><p>LIBER ${book.roman} · ${escapeHtml(chapter.label.toUpperCase())}</p><h1>${escapeHtml(chapter.title)}</h1>${chapter.latinTitle ? `<span lang="la">${escapeHtml(chapter.latinTitle)}</span>` : ''}</header>
      <figure>
        <div class="leaf-plate-crop leaf-plate-contained"><a class="leaf-plate-trigger" href="${shareImage.avif}" target="_blank" rel="noopener" aria-haspopup="dialog" aria-controls="leaf-plate-dialog" aria-label="Open the complete illustration"><picture style="--leaf-size:100%;--leaf-left:0%;--leaf-top:0%;--leaf-x:50%;--leaf-y:50%"><source type="image/avif" srcset="${shareImage.avif} ${shareImage.width}w" sizes="(max-width: 760px) 100vw, 920px"><img src="${shareImage.fallback}" width="${shareImage.width}" height="${shareImage.height}" alt="${escapeHtml(illustration.alt)}"></picture><span class="leaf-expand" aria-hidden="true">Expand image</span></a></div>
        <figcaption>${escapeHtml(illustration.englishCaption)} · modern editorial plate</figcaption>
        <dialog class="leaf-lightbox" id="leaf-plate-dialog" aria-label="Complete chapter illustration"><form method="dialog"><button class="leaf-lightbox-close" value="close" aria-label="Close complete illustration">Close</button></form><picture><source type="image/avif" srcset="${shareImage.avif}"><img src="${shareImage.fallback}" width="${shareImage.width}" height="${shareImage.height}" alt="${escapeHtml(illustration.alt)}"></picture></dialog>
      </figure>
${historicalNotice ? `      ${historicalNotice}\n` : ''}      <div class="parallel-text"><section aria-labelledby="latin-source"><h2 class="text-kicker" id="latin-source">Latine · Mayhoff 1906</h2>${paragraphs(chapter.latin, 'la')}</section><section aria-labelledby="english-source"><h2 class="text-kicker" id="english-source">English · Bostock &amp; Riley 1855–57</h2>${paragraphs(chapter.english, 'en')}</section></div>
      <footer class="leaf-sources"><p>Complete bilingual reading unit ${chapterOrdinal + 1} of ${manifest.totalChapters}. Critical apparatus and translation footnotes are omitted; source order is preserved.</p><nav><a href="/edition">Edition & sources</a><a href="/privacy">Privacy</a><a href="/provenance.json">Provenance ledger</a></nav></footer>
    </article>
    <nav class="leaf-pagination" aria-label="Adjacent chapters">${adjacentLink(prior, '← Previous leaf')}${nextLink}</nav>
  </main>
</body>
</html>`;
  const directory = path.join(readRoot, String(book.number));
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${encodedId}.html`), html);
  totalBytes += Buffer.byteLength(html);
  urls.push(pathname);
}

const sitemapUrls = policy.publicIndexing ? urls : [];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map((url) => `  <url><loc>${origin}${url}</loc><lastmod>${policy.releaseDate}</lastmod></url>`).join('\n')}\n</urlset>\n`;
await writeFile(path.join(publicRoot, 'sitemap.xml'), sitemap);
console.log(`Built ${records.length.toLocaleString('en-US')} bilingual share leaves / ${(totalBytes / 1024 / 1024).toFixed(2)} MiB HTML / ${sitemapUrls.length.toLocaleString('en-US')} indexed sitemap URLs`);
