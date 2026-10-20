import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDictionaryMacrons, validateMacronLexicon } from '../app/macrons.mjs';
import { tokenizeSearchText } from '../app/search.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative));
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const receipt = JSON.parse(read('corpus-source/macrons/receipt.json'));
assert.deepEqual(JSON.parse(read('public/macrons/receipt.json')), receipt);
assert.equal(hash(read('corpus-source/macrons/LICENSE')), hash(read('public/macrons/LICENSE')));
const payload = read(`public${receipt.lexicon.file}`);
assert.equal(payload.length, receipt.lexicon.bytes);
assert.equal(hash(payload), receipt.lexicon.sha256);
assert.ok(receipt.lexicon.file.includes(receipt.lexicon.sha256.slice(0, 16)));
const entries = validateMacronLexicon(JSON.parse(payload));
assert.equal(Object.keys(entries).length, receipt.lexicon.entries);
assert.equal(addDictionaryMacrons('Naturalis historia: naturae, mundi.', entries), 'Nātūrālis historia: nātūrae, mundī.');
assert.equal(addDictionaryMacrons('malum liber rosa', entries), 'malum liber rosa', 'Ambiguous quantities must not be guessed.');
assert.equal(addDictionaryMacrons('NATVRAE naturae', entries), 'NĀTVRAE nātūrae', 'Lookup normalization must preserve historical spelling and case.');
assert.equal(addDictionaryMacrons('VIII C. Mārcus a\u0304 λόγος xyzzy', entries), 'VIII C. Mārcus a\u0304 λόγος xyzzy');
assert.equal(addDictionaryMacrons('naturae', null), 'naturae', 'Off/loading/failure must preserve the source.');
assert.throws(() => validateMacronLexicon({ schemaVersion: 1, entries: { natura: [0, 99] } }));
assert.throws(() => validateMacronLexicon({ schemaVersion: 1, entries: { natura: [0] } }));
assert.throws(() => validateMacronLexicon({ schemaVersion: 1, entries: { natura: [1, 1] } }));
assert.throws(() => validateMacronLexicon({ schemaVersion: 2, entries: {} }));
assert.throws(() => validateMacronLexicon({ schemaVersion: 1, entries: [] }));
const removeMacrons = (text) => text.normalize('NFD').replaceAll('\u0304', '').normalize('NFC');
let passages = 0;
for (const [relative, expectedHash] of Object.entries(receipt.sourceFiles)) {
  const bytes = read(relative);
  assert.equal(hash(bytes), expectedHash, `Macron source receipt is stale: ${relative}`);
  const data = JSON.parse(bytes);
  const texts = data.chapters
    ? data.chapters.flatMap((chapter) => [chapter.latin, chapter.latinTitle])
    : data.letters.flatMap((letter) => [letter.latinHeading, ...letter.folios.map((folio) => folio.latin)]);
  for (const text of texts) {
    const marked = addDictionaryMacrons(text, entries);
    assert.equal(removeMacrons(marked), removeMacrons(text), 'The reading aid changed source letters or layout.');
    assert.equal(marked.length, text.length, 'UTF-16 offsets must be preserved.');
    assert.deepEqual(tokenizeSearchText(marked), tokenizeSearchText(text), 'Search tokens or passage positions changed.');
    assert.equal(addDictionaryMacrons(marked, entries), marked, 'The reading aid must be idempotent.');
    passages += 1;
  }
}
console.log(`Verified ${entries ? Object.keys(entries).length : 0} dictionary entries across ${passages} Latin passages/titles; source spelling, search positions, ambiguity, integrity, case and off-mode preserved.`);
