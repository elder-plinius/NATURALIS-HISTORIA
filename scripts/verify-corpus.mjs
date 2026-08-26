import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { corpusBookMeta, corpusBookUrl } from './corpus-path.mjs';

const root = new URL('../public/corpus/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
const countWords = (text) => (text.match(/\p{L}+(?:['’]\p{L}+)?/gu) ?? []).length;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(manifest.totalBooks === 37, `Expected 37 books, found ${manifest.totalBooks}`);
assert(manifest.books.length === 37, `Expected 37 catalogue rows, found ${manifest.books.length}`);

let chapterCount = 0;
let latinWords = 0;
let englishWords = 0;
let englishEndmatterWords = 0;
let allLatin = '';
let allEnglish = '';
const loadedBooks = new Map();

async function readBook(bookNumber) {
  const cached = loadedBooks.get(bookNumber);
  if (cached) return cached;
  const meta = corpusBookMeta(manifest, bookNumber);
  const book = JSON.parse(await readFile(corpusBookUrl(meta, root), 'utf8'));
  loadedBooks.set(bookNumber, book);
  return book;
}

for (const meta of manifest.books) {
  const bookBytes = await readFile(corpusBookUrl(meta, root));
  const bookDigest = createHash('sha256').update(bookBytes).digest('hex');
  assert(bookDigest === meta.sha256, `Book ${meta.number} manifest digest is stale`);
  assert(bookBytes.byteLength === meta.byteLength, `Book ${meta.number} byte length is stale`);
  assert(meta.file.endsWith(`.${bookDigest.slice(0, 16)}.json`), `Book ${meta.number} filename digest is stale`);
  const book = JSON.parse(bookBytes.toString('utf8'));
  loadedBooks.set(meta.number, book);
  assert(book.number === meta.number, `Book ${meta.number} payload is misnumbered`);
  assert(book.chapters.length === meta.chapterCount, `Book ${meta.number} catalogue count is stale`);
  const keys = new Set();
  const englishChapterNumbers = [];
  let previousChapterEnd = 0;
  let mayhoffMarkerCount = 0;
  assert(Array.isArray(book.englishEndmatter), `Book ${meta.number} has no English endmatter ledger`);
  englishEndmatterWords += book.englishEndmatter.reduce((total, part) => total + countWords(part), 0);
  for (const chapter of book.chapters) {
    const key = `${book.number}:${chapter.id}`;
    assert(!keys.has(key), `Duplicate bilingual-unit key ${key}`);
    keys.add(key);
    assert(chapter.latin.trim(), `${key} has no Latin text`);
    assert(chapter.english.trim(), `${key} has no English text`);
    assert(countWords(chapter.latin) === chapter.latinWords, `${key} Latin count is stale`);
    assert(countWords(chapter.english) === chapter.englishWords, `${key} English count is stale`);
    assert(Array.isArray(chapter.englishChapters), `${key} has no English heading ledger`);
    assert(Array.isArray(chapter.mayhoffSections), `${key} has no Mayhoff section-marker ledger`);
    mayhoffMarkerCount += chapter.mayhoffSections.length;
    englishChapterNumbers.push(...chapter.englishChapters.map((heading) => heading.number));
    if (meta.number !== 1) {
      assert(Number(chapter.id) === chapter.chapterStart, `${key} id/start mismatch`);
      assert(chapter.chapterStart === chapter.chapterEnd, `${key} still groups distinct Latin chapters`);
      assert(chapter.chapterStart === previousChapterEnd + 1, `${key} breaks contiguous Latin chapter order`);
      previousChapterEnd = chapter.chapterEnd;
    }
    chapterCount += 1;
    latinWords += chapter.latinWords;
    englishWords += chapter.englishWords;
    allLatin += `\n${chapter.latin}`;
    allEnglish += `\n${chapter.english}`;
  }
  if (meta.number !== 1) {
    assert(meta.latinChapterStart === 1, `Book ${meta.number} does not start at Latin chapter 1`);
    assert(previousChapterEnd === meta.latinChapterEnd, `Book ${meta.number} does not reach its final Latin chapter`);
    assert(book.chapters.length === meta.latinChapterCount, `Book ${meta.number} chapter coverage count is stale`);
  }
  assert(mayhoffMarkerCount === meta.mayhoffSectionMarkerCount, `Book ${meta.number} Mayhoff marker count is stale`);
  if (meta.englishChapterCount !== undefined) {
    const uniqueEnglishChapters = new Set(englishChapterNumbers);
    assert(englishChapterNumbers.length === meta.englishChapterCount, `Book ${meta.number} English heading count is stale`);
    assert(uniqueEnglishChapters.size === meta.englishChapterCount, `Book ${meta.number} repeats an English heading`);
    assert(Math.max(...englishChapterNumbers) === meta.englishChapterMax, `Book ${meta.number} English heading range is stale`);
  }
}

assert(chapterCount === manifest.totalChapters, 'Manifest bilingual-unit total is stale');
assert(latinWords === manifest.totalLatinWords, 'Manifest Latin word total is stale');
assert(englishWords === manifest.totalEnglishWords, 'Manifest English word total is stale');
assert(englishEndmatterWords === manifest.totalEnglishEndmatterWords, 'Manifest English endmatter total is stale');
assert(allLatin.startsWith('\nLibros Naturalis Historiae'), 'Book I does not begin with Pliny’s dedication');
assert(allEnglish.startsWith('\nThis treatise on Natural History'), 'Book I English drop cap/order is broken');
assert(allLatin.includes('Nunc reliqua cultura tradetur per genera frugum'), 'Book XVIII standalone Latin quotation is missing');
assert(allLatin.includes('Quo tua, Romanae vindex clarissime linguae'), 'Book XXXI Latin poem is missing');
assert(allEnglish.includes('For still thou ne’er wouldst quite despise'), 'Book I English verse is missing');
assert(allEnglish.includes('Great prince of Roman eloquence, thy grove'), 'Book XXXI English poem is missing');
assert(!allLatin.includes('pb n='), 'A malformed TEI page-break marker survives in Latin reading text');
assert(!allLatin.includes('§'), 'A malformed apparatus section sign survives in Latin reading text');
assert(!allLatin.includes('cadmean, 32, celebri'), 'A marginal reference survives in Book XXXIV');
assert(allLatin.includes('alienae quoque religionis intellectu'), 'Book VIII line-wrap repair regressed');
assert(allLatin.includes('adgnascentiumque iis natura'), 'Book XXXV line-wrap/addition repair regressed');
for (const split of [
  'ven- 10 tosus', 'ap- 31 pellant', 'vo- 23 cetur', 'si- 5 dere',
  'ter- 180 tium', 'aqua- 15 rum', 'sim- 199 plex', 'simi- 10 lis',
  'pin- 5 gue', 'im- 5 brem', 'co- 302 lumnis', 'adver- 5 satur',
  'pecti- 5 num', 'coclea- 5 rum',
]) assert(!allLatin.includes(split), `Verified print-line split survives: ${split}`);
assert(!/[ \t]+[,!?;:]/.test(allLatin), 'Latin contains horizontal whitespace before punctuation');
assert(!/[ \t]+[,!?;:]/.test(allEnglish), 'English contains horizontal whitespace before punctuation');

const bookEightMeta = manifest.books[7];
const bookEight = await readBook(8);
const latinChapterForEnglishHeading = (book, englishChapterNumber) => book.chapters
  .find((chapter) => chapter.englishChapters.some((heading) => heading.number === englishChapterNumber))
  ?.id;
assert(bookEightMeta.latinChapterEnd === 59, 'Book VIII must reach Latin chapter 59');
assert(bookEightMeta.englishChapterMax === 84, 'Book VIII must expose all 84 Bostock-Riley headings');
assert(bookEight.chapters.length === 59, 'Book VIII must expose all 59 Latin chapters independently');
assert(bookEight.chapters.some((chapter) => chapter.id === '34'), 'Book VIII chapter 34 is missing');
assert(bookEight.chapters.some((chapter) => chapter.id === '48'), 'Book VIII chapter 48 is missing');
assert(latinChapterForEnglishHeading(bookEight, 33) === '21', 'Book VIII Bostock-Riley chapter 33 must map to Latin chapter 21');
assert(latinChapterForEnglishHeading(bookEight, 84) === '59', 'Book VIII Bostock-Riley chapter 84 must map to Latin chapter 59');

const bookSeven = await readBook(7);
assert(latinChapterForEnglishHeading(bookSeven, 3) === '3', 'Book VII Bostock-Riley chapter 3 must follow its leading chapter marker');
assert(latinChapterForEnglishHeading(bookSeven, 60) === '60', 'Book VII Bostock-Riley chapter 60 must follow its leading chapter marker');

const bookFour = await readBook(4);
assert(latinChapterForEnglishHeading(bookFour, 1) === '1', 'Book IV Epirus must begin Latin chapter 1');
assert(latinChapterForEnglishHeading(bookFour, 2) === '1', 'Book IV Acarnania must remain in Latin chapter 1');
assert(latinChapterForEnglishHeading(bookFour, 3) === '2', 'Book IV Aetolia must begin Latin chapter 2');
assert(bookFour.chapters[0].english.includes('Upon it are Epirus, Acarnania, Ætolia'), 'Book IV chapter 1 lost its geographical opening');
assert(bookFour.chapters[0].latin.includes('Acarnaniae, quae'), 'Book IV chapter 1 lost Acarnania in Latin');
assert(bookFour.chapters[0].english.includes('Epirus, properly so called'), 'Book IV chapter 1 lost Epirus in English');
assert(bookFour.chapters[0].english.includes('The towns of Acarnania'), 'Book IV chapter 1 lost Acarnania in English');
assert(bookFour.chapters[1].latin.startsWith('Aetolorum populi'), 'Book IV chapter 2 starts at the wrong Latin boundary');
assert(bookFour.chapters[1].english.startsWith('The peoples of Ætolia'), 'Book IV chapter 2 starts at the wrong translation boundary');
assert(!bookFour.chapters[1].english.includes('Epirus, properly so called'), 'Book IV chapter 2 repeats Epirus');
assert(JSON.stringify(bookFour.chapters[0].mayhoffSections) === JSON.stringify(['1', '2', '3', '4', '5']), 'Book IV chapter 1 Mayhoff marker ledger drifted');
assert(JSON.stringify(bookFour.chapters[1].mayhoffSections) === JSON.stringify(['6']), 'Book IV chapter 2 Mayhoff marker ledger drifted');
assert(JSON.stringify(bookEight.chapters[0].mayhoffSections) === JSON.stringify(['1', '2', '3']), 'Book VIII chapter 1 Mayhoff marker ledger drifted');

const semanticAnchors = [
  [7, '2', 'Scytharum', 'Scythians'], [7, '45', 'Augusto', 'Augustus'],
  [8, '34', 'tarandrus', 'tarandrus'], [8, '43', 'Asinum', 'ass'],
  [8, '48', 'lana', 'wool'], [10, '43', 'corvis', 'raven'],
  [11, '7', 'commosin', 'commosis'], [12, '24', 'Cypros', 'cyprus'],
  [18, '26', 'culturae', 'agriculture'], [20, '7', 'Lactucae', 'lettuce'],
  [21, '32', 'Corchorum', 'corchorus'], [23, '9', 'Myrtus', 'myrtle'],
  [24, '10', 'virga sanguinea', 'blood-red shrub'], [27, '13', 'Solanum', 'solanum'],
];
for (const [bookNumber, chapterId, latinAnchor, englishAnchor] of semanticAnchors) {
  const book = await readBook(bookNumber);
  const unit = book.chapters.find((chapter) => chapter.id === chapterId);
  assert(unit?.latin.toLocaleLowerCase().includes(String(latinAnchor).toLocaleLowerCase()), `Book ${bookNumber}.${chapterId} lost Latin anchor ${latinAnchor}`);
  assert(unit?.english.toLocaleLowerCase().includes(String(englishAnchor).toLocaleLowerCase()), `Book ${bookNumber}.${chapterId} lost English anchor ${englishAnchor}`);
}

const correctionPath = manifest.corrections.file.replace('/corpus/', '');
const correctionBytes = await readFile(new URL(correctionPath, root));
const correctionDigest = createHash('sha256').update(correctionBytes).digest('hex');
assert(correctionDigest === manifest.corrections.sha256, 'Correction ledger digest is stale');
const corrections = JSON.parse(correctionBytes.toString('utf8'));
assert(corrections.schemaVersion === 1, 'Correction ledger schema is unsupported');
assert(corrections.latinConfirmed.length === 8, 'Confirmed Latin correction count drifted');
assert(corrections.latinExtractionRepairs.length === 26, 'Latin extraction-repair count drifted');
assert(corrections.gutenbergVolume1AppendixForRead.length === 27, 'Gutenberg Appendix count drifted');
const englishReaderCorrections = corrections.gutenbergVolume1AppendixForRead.filter((entry) => entry.scope === 'reader');
const englishExcludedCorrections = corrections.gutenbergVolume1AppendixForRead.filter((entry) => entry.scope !== 'reader');
assert(englishReaderCorrections.length === 25, 'Gutenberg reader correction count drifted');
assert(englishExcludedCorrections.length === 2, 'Gutenberg excluded correction count drifted');
assert(englishExcludedCorrections.every((entry) => entry.scope.startsWith('excluded-')), 'Excluded corrections lack explicit reasons');
assert(corrections.gutenbergVolume1AppendixSupplemental.length === 1, 'Gutenberg supplemental note is missing');

for (const [language, entries] of [
  ['latin', corrections.latinConfirmed],
  ['english', englishReaderCorrections],
]) {
  for (const entry of entries) {
    const book = await readBook(entry.book);
    const unit = book.chapters.find((chapter) => chapter.id === entry.unit);
    assert(unit, `${entry.id} points at a missing unit`);
    assert(!unit[language].includes(entry.before), `${entry.id} old scoped reading remains`);
    assert(unit[language].includes(entry.after), `${entry.id} corrected scoped reading is missing`);
  }
}

console.log(
  `Verified ${manifest.totalBooks} books / ${chapterCount} bilingual chapter units / ` +
  `${latinWords.toLocaleString('en-US')} Latin words / ${englishWords.toLocaleString('en-US')} English words / ` +
  `8 confirmed Latin and 25 emitted English Appendix corrections`,
);
