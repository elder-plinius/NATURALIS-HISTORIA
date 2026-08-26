import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'app', 'afterword', 'vesuvius', 'letters-data.json');
const perseusCommit = '422896dde7f07509f151d18bb5fe351b77458748';
const latinUrl = `https://raw.githubusercontent.com/PerseusDL/canonical-latinLit/${perseusCommit}/data/phi1318/phi001/phi1318.phi001.perseus-lat1.xml`;
const englishUrl = 'https://www.gutenberg.org/cache/epub/2811/pg2811.txt';
const expectedHashes = {
  latin: '313c67a08efae2c33d95cdb52004be5a0b6b5c2d8a58ecfd08dffdfc1465f257',
  english: '38246747bde7ef4da17603bee74b5344cc1502f8e41d6515fe72651ca0e8fa9a',
};

const folioPlans = {
  '6.16': [
    { sections: [1, 3], title: 'For memory and history', panel: 'observer' },
    { sections: [4, 7], title: 'The pine-shaped cloud', panel: 'observer' },
    { sections: [8, 11], title: 'The appeal and the fleet', panel: 'appeal' },
    { sections: [12, 13], title: 'Toward Stabiae', panel: 'fleet' },
    { sections: [14, 20], title: 'The darkened shore', panel: 'ash' },
    { sections: [21, 22], title: 'Letter, testimony, history', panel: 'ash' },
  ],
  '6.20': [
    { sections: [1, 5], title: 'The account resumes', panel: 'tablets' },
    { sections: [6, 9], title: 'Earth, sea, and cloud', panel: 'observer' },
    { sections: [10, 12], title: 'Refusing to leave', panel: 'ash' },
    { sections: [13, 15], title: 'A night without light', panel: 'ash' },
    { sections: [16, 17], title: 'Ash upon the living', panel: 'ash' },
    { sections: [18, 20], title: 'The altered world', panel: 'tablets' },
  ],
};

const englishMarkers = {
  '6.16': [
    'YOUR request that I would send you an account',
    'He was at that time with the fleet',
    'As he was coming out of the house',
    'Pomponianus was then at Stabiae',
    'The court which led to his apartment',
    'During all this time my mother and I',
  ],
  '6.20': [
    'THE letter which, in compliance with your request',
    'Though it was now morning',
    'Upon this our Spanish friend',
    'The ashes now began to fall upon us',
    'It now grew rather lighter',
    'At last this dreadful darkness was dissipated',
  ],
};

const metadata = {
  '6.16': {
    canonicalReference: 'Epistulae VI.16',
    ctsUrn: 'urn:cts:latinLit:phi1318.phi001.perseus-lat1:6.16',
    editorialTitle: 'The Death of Pliny the Elder',
    summary: 'Tacitus asks for an account of the Elder’s death. Observation becomes a rescue voyage toward Stabiae.',
  },
  '6.20': {
    canonicalReference: 'Epistulae VI.20',
    ctsUrn: 'urn:cts:latinLit:phi1318.phi001.perseus-lat1:6.20',
    editorialTitle: 'The Eruption at Misenum',
    summary: 'The Younger resumes the story: earthquake, retreating sea, darkness, ash, and escape with his mother.',
  },
};

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'Naturalis-Historia-source-import/1.0' } });
  if (!response.ok) throw new Error(`Source returned ${response.status}: ${url}`);
  return response.text();
}

function stripXml(value) {
  return value
    .replace(/<\/p>\s*<p>/g, '\n\n')
    .replace(/<\/l>\s*<l[^>]*>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s*\n\s*/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function extractLatinLetter(xml, letterNumber) {
  const bookStart = xml.indexOf('<div type="textpart" n="6" subtype="book">');
  const bookEnd = xml.indexOf('<div type="textpart" n="7" subtype="book">', bookStart);
  if (bookStart < 0 || bookEnd < 0) throw new Error('Perseus Book VI was not found.');
  const book = xml.slice(bookStart, bookEnd);
  const startMarker = `<div type="textpart" n="${letterNumber}" subtype="letter">`;
  const endMarker = `<div type="textpart" n="${letterNumber + 1}" subtype="letter">`;
  const start = book.indexOf(startMarker);
  const end = book.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`Perseus letter 6.${letterNumber} was not found.`);
  const fragment = book.slice(start, end);
  const heading = stripXml(fragment.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '');
  const sections = [...fragment.matchAll(/<div type="textpart" n="(\d+)" subtype="section">([\s\S]*?)<\/div>/g)]
    .map((match) => ({ number: Number(match[1]), text: stripXml(match[2]) }));
  if (!sections.length) throw new Error(`Perseus letter 6.${letterNumber} has no sections.`);
  return { heading, sections };
}

function normalizeEnglish(value) {
  return value
    .replace(/\r/g, '')
    .replace(/\[(?:92|93|94|95)\]/g, '')
    .replace(/-\n(?=[A-Za-z])/g, '-')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/Miscnum/g, 'Misenum')
    .trim();
}

function extractEnglishLetter(text, heading, nextHeading) {
  const normalizedText = text.replace(/\r/g, '');
  const bodyStart = normalizedText.indexOf('*** START OF THE PROJECT GUTENBERG EBOOK');
  const tableEntry = normalizedText.indexOf(`\n${heading}\n`, bodyStart);
  const start = normalizedText.indexOf(`\n${heading}\n`, tableEntry + heading.length);
  const end = normalizedText.indexOf(`\n${nextHeading}\n`, start + heading.length);
  if (start < 0 || end < 0) throw new Error(`Gutenberg letter ${heading} was not found.`);
  return normalizeEnglish(normalizedText.slice(start + heading.length + 2, end));
}

function splitEnglish(text, markers, id) {
  const positions = markers.map((marker) => text.indexOf(marker));
  if (positions.some((position) => position < 0) || positions[0] !== 0) {
    throw new Error(`Gutenberg scene boundaries drifted for ${id}: ${positions.join(', ')}; opening=${JSON.stringify(text.slice(0, 80))}`);
  }
  return positions.map((position, index) => text.slice(position, positions[index + 1] ?? text.length).trim());
}

function groupLatin(sections, [start, end]) {
  const selected = sections.filter((section) => section.number >= start && section.number <= end);
  if (selected.length !== end - start + 1) throw new Error(`Latin section range ${start}–${end} is incomplete.`);
  return selected.map((section) => section.text).join('\n\n');
}

const [latinSource, englishSource] = await Promise.all([fetchText(latinUrl), fetchText(englishUrl)]);
if (sha256(latinSource) !== expectedHashes.latin) throw new Error('The pinned Perseus source hash changed.');
if (sha256(englishSource) !== expectedHashes.english) throw new Error('The Project Gutenberg source hash changed.');

const sourceLetters = {
  '6.16': {
    latin: extractLatinLetter(latinSource, 16),
    english: extractEnglishLetter(englishSource, 'LXV -- To TACITUS', 'LXVI -- To CORNELIUS TACITUS'),
  },
  '6.20': {
    latin: extractLatinLetter(latinSource, 20),
    english: extractEnglishLetter(englishSource, 'LXVI -- To CORNELIUS TACITUS', 'LX VII -- To MACER'),
  },
};

const letters = Object.entries(sourceLetters).map(([id, source]) => {
  const english = splitEnglish(source.english, englishMarkers[id], id);
  const folios = folioPlans[id].map((folio, index) => ({
    number: index + 1,
    sectionStart: folio.sections[0],
    sectionEnd: folio.sections[1],
    editorialTitle: folio.title,
    panel: folio.panel,
    latin: groupLatin(source.latin.sections, folio.sections),
    english: english[index],
  }));
  return {
    id,
    ...metadata[id],
    latinHeading: source.latin.heading,
    sectionCount: source.latin.sections.length,
    folios,
  };
});

const data = {
  schemaVersion: 1,
  title: 'Afterword — Two Letters from Vesuvius',
  editorialBoundary: 'These later letters by Pliny the Younger are presented after the complete thirty-seven books; they are not part of Naturalis Historia.',
  importedOn: '2026-08-24',
  latinSource: {
    work: 'Pliny the Younger, Epistulae',
    edition: 'Perseus canonical-latinLit, perseus-lat1',
    commit: perseusCommit,
    url: latinUrl,
    sha256: expectedHashes.latin,
    license: 'CC-BY-SA-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    modifications: ['TEI markup omitted', 'unmacronized reading text retained', 'sections grouped into six editorial folios per letter'],
  },
  englishSource: {
    work: 'Letters of Pliny',
    translator: 'William Melmoth',
    reviser: 'F. C. T. Bosanquet',
    source: 'Project Gutenberg ebook 2811',
    url: englishUrl,
    sha256: expectedHashes.english,
    rightsBasis: 'Public domain in the United States according to Project Gutenberg; status may differ elsewhere.',
    modifications: ['line wrapping normalized', 'Gutenberg footnote markers omitted', 'one obvious transcription error, Miscnum, normalized to Misenum', 'paragraphing grouped into six editorial folios per letter'],
  },
  dateNote: 'The selected texts give 24 August AD 79. The eruption date remains disputed; this afterword preserves the source wording rather than silently revising it.',
  letters,
};

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Imported ${letters.length} Vesuvius letters / ${letters.reduce((sum, letter) => sum + letter.folios.length, 0)} folios`);
