import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import policy from '../edition-policy.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const manifest = JSON.parse(await readFile(path.join(publicRoot, 'corpus', 'manifest.json'), 'utf8'));
const certifiedArtworkManifest = JSON.parse(await readFile(path.join(root, 'assets-source', 'chapter-artwork-manifest.json'), 'utf8'));
const fail = (condition, message) => { if (!condition) throw new Error(message); };
let count = 0;
let bytes = 0;
for (const book of await readdir(path.join(publicRoot, 'read'))) {
  for (const chapterFile of await readdir(path.join(publicRoot, 'read', book))) {
    fail(chapterFile.endsWith('.html'), `${book}/${chapterFile} is not a standalone HTML leaf`);
    const chapter = chapterFile.slice(0, -'.html'.length);
    const file = path.join(publicRoot, 'read', book, chapterFile);
    const html = await readFile(file, 'utf8');
    count += 1;
    bytes += (await stat(file)).size;
    const expectedRobots = policy.publicIndexing ? 'index,follow' : 'noindex,nofollow,noarchive';
    fail(html.includes(`<meta name="robots" content="${expectedRobots}">`), `${book}/${chapter} disagrees with the release indexing policy`);
    fail(html.includes(`rel="canonical" href="${policy.origin}/read/${book}/${chapter}.html"`), `${book}/${chapter} canonical drifted`);
    fail(html.includes('Enter the Living Codex'), `${book}/${chapter} has no interactive-reader handoff`);
    fail(html.includes('aria-labelledby="latin-source"') && html.includes('aria-labelledby="english-source"'), `${book}/${chapter} has unnamed language regions`);
    fail(html.includes('"@type":"Chapter"') && !html.includes('"@type":"ScholarlyArticle"'), `${book}/${chapter} has incorrect structured-data semantics`);
    fail(html.includes('class="leaf-plate-crop leaf-plate-contained"') && html.includes('--leaf-size:100%') && html.includes('--leaf-left:0%') && html.includes('--leaf-top:0%'), `${book}/${chapter} is not presenting its complete certified illustration`);
    fail(html.includes('class="leaf-plate-trigger"') && html.includes('aria-haspopup="dialog"') && html.includes('<dialog class="leaf-lightbox"') && html.includes('/reading-leaf.js?v='), `${book}/${chapter} lost its full-image interaction`);
    fail(!html.includes('/assets/') || /\.(?:avif|webp)/.test(html), `${book}/${chapter} references an unoptimized plate`);
  }
}
fail(count === manifest.totalChapters, `Expected ${manifest.totalChapters} share pages, found ${count}`);
fail(bytes < 16 * 1024 * 1024, `Share-page HTML exceeds 16 MiB: ${bytes}`);
const remedies = await readFile(path.join(publicRoot, 'read', '28', '8.html'), 'utf8');
fail(remedies.includes('Historical remedies—not medical advice'), 'Remedy share page lacks its content notice');
const sample = await readFile(path.join(publicRoot, 'read', '8', '14.html'), 'utf8');
fail(sample.includes('Bostock &amp; Riley 1855–57') && sample.includes('Mayhoff 1906'), 'Sample share page lost bilingual source labels');
fail(sample.includes('<link rel="icon" href="/favicon.svg" type="image/svg+xml">'), 'Share leaves do not declare the edition favicon');
const originalScene = await readFile(path.join(publicRoot, 'read', '2', '15.html'), 'utf8');
fail(originalScene.includes('leaf-plate-contained') && originalScene.includes('/assets/chapter-b02-c015.') && originalScene.includes('.w1536.avif'), 'Original-scene share leaf is not delivered uncropped');
const certifiedAtlasEntry = Object.entries(certifiedArtworkManifest.assignments ?? {})
  .find(([, assignment]) => assignment.kind === 'atlas-cell');
fail(Boolean(certifiedAtlasEntry), 'Certified artwork manifest has no atlas-cell assignment to verify');
const [certifiedAtlasKey, certifiedAtlasAssignment] = certifiedAtlasEntry;
const [certifiedAtlasBook, certifiedAtlasChapter] = certifiedAtlasKey.split(':');
const certifiedCell = await readFile(path.join(publicRoot, 'read', certifiedAtlasBook, `${certifiedAtlasChapter}.html`), 'utf8');
const certifiedCellStem = `${path.basename(certifiedAtlasAssignment.sourceArtifact, path.extname(certifiedAtlasAssignment.sourceArtifact))}-cell-${certifiedAtlasAssignment.cell.toLowerCase()}`;
fail(certifiedCell.includes('leaf-plate-contained') && certifiedCell.includes(certifiedCellStem) && certifiedCell.includes('.w512.avif'), 'Certified atlas-cell share leaf is not delivered uncropped');
const favicon = await readFile(path.join(publicRoot, 'favicon.svg'), 'utf8');
fail(favicon.includes('data-edition="naturalis-historia"'), 'The intentional edition favicon was replaced by a placeholder');
const finalLeaf = await readFile(path.join(publicRoot, 'read', '37', '13.html'), 'utf8');
fail(finalLeaf.includes('href="/afterword/vesuvius"') && finalLeaf.includes('Pliny the Younger'), 'Final corpus leaf does not hand off to the separate afterword');
const sitemap = await readFile(path.join(publicRoot, 'sitemap.xml'), 'utf8');
const expectedSitemapUrls = policy.publicIndexing ? manifest.totalChapters + 5 : 0;
fail((sitemap.match(/<url>/g) ?? []).length === expectedSitemapUrls, 'Sitemap URL count drifted from the release indexing policy');

console.log(`Verified ${count.toLocaleString('en-US')} bilingual share leaves / ${(bytes / 1024 / 1024).toFixed(2)} MiB HTML / ${policy.accessMode} indexing gate`);
