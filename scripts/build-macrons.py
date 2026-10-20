"""Build a conservative optional reading aid from Alatius' pinned lexicon.

Usage: python3 scripts/build-macrons.py /path/to/macrons.txt
The input is not fetched implicitly. Download it from SOURCE_URL and retain its
upstream licence. Only dictionary-agreed long-vowel positions are emitted.
"""
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
SOURCE_COMMIT = '81f95a10a46f394e43e0e45ab445c1e0fa2c06b5'
SOURCE_URL = f'https://raw.githubusercontent.com/Alatius/latin-macronizer/{SOURCE_COMMIT}/latin_macronizer/macrons.txt'
SOURCE_SHA256 = 'b22950c26ad203f03fafc07e94db6f24d70843f025f2572f0b2e141da0957e63'
WORD = re.compile(r'[^\W\d_]+', re.UNICODE)


def key(word):
    return word.lower().replace('v', 'u').replace('j', 'i')


def positions(form, accented):
    # _^ denotes an uncertain quantity in the source. Never promote it to long.
    accented = accented.lower().replace('_^', '').replace('^', '')
    plain = ''
    marked = set()
    for char in accented:
        if char == '_':
            if not plain or plain[-1] not in 'aeiouy':
                return None
            marked.add(len(plain) - 1)
        elif char in 'abcdefghijklmnopqrstuvwxyz':
            plain += char
        else:
            return None
    return marked if key(plain) == key(form) else None


def build(source_path):
    source = source_path.read_bytes()
    if hashlib.sha256(source).hexdigest() != SOURCE_SHA256:
        raise ValueError('Macron lexicon differs from the pinned source hash.')
    manifest = json.loads((ROOT / 'public/corpus/manifest.json').read_text())
    paths = [ROOT / 'public' / book['file'].lstrip('/') for book in manifest['books']]
    paths.append(ROOT / 'app/afterword/vesuvius/letters-data.json')
    texts = []
    source_files = {}
    for path in paths:
        raw = path.read_bytes()
        source_files[path.relative_to(ROOT).as_posix()] = hashlib.sha256(raw).hexdigest()
        data = json.loads(raw)
        if 'chapters' in data:
            texts += [item[field] for item in data['chapters'] for field in ['latin', 'latinTitle']]
        else:
            texts += [letter['latinHeading'] for letter in data['letters']]
            texts += [folio['latin'] for letter in data['letters'] for folio in letter['folios']]
    tokens = [match.group() for text in texts for match in WORD.finditer(text)]
    vocabulary = {key(word) for word in tokens if word.isascii()}
    agreement = {}
    rejected = set()
    ambiguous = set()
    for line in source.decode('utf-8').splitlines():
        if line.startswith('#') or not line.strip():
            continue
        form, _tag, _lemma, accented = line.split()
        normalized = key(form)
        if normalized not in vocabulary:
            continue
        marks = positions(form, accented)
        if marks is None:
            rejected.add(normalized)
            continue
        if normalized in agreement:
            if marks != agreement[normalized]:
                ambiguous.add(normalized)
            agreement[normalized] &= marks
        else:
            agreement[normalized] = marks
    entries = {word: sorted(marks) for word, marks in sorted(agreement.items()) if marks and word not in rejected}
    payload = (json.dumps({'schemaVersion': 1, 'entries': entries}, separators=(',', ':'), ensure_ascii=False) + '\n').encode()
    digest = hashlib.sha256(payload).hexdigest()
    output = f'/macrons/lexicon.{digest[:16]}.json'
    (ROOT / 'public' / output.lstrip('/')).write_bytes(payload)
    receipt = {
        'schemaVersion': 1,
        'method': 'Intersection of long-vowel positions across all supplied dictionary analyses; uncertain quantities, unmapped analyses, unknown words, and ambiguous vowels are not guessed. No POS tagging or contextual disambiguation.',
        'scope': 'Main Latin passages/titles and Vesuvius Latin passages; base source text and search index unchanged.',
        'source': {'creator': 'Johan Winge', 'repository': 'https://github.com/Alatius/latin-macronizer', 'commit': SOURCE_COMMIT, 'url': SOURCE_URL, 'sha256': SOURCE_SHA256, 'license': 'GPL-3.0', 'licenseFile': 'corpus-source/macrons/LICENSE'},
        'lexicon': {'file': output, 'sha256': digest, 'bytes': len(payload), 'entries': len(entries)},
        'coverage': {'wordOccurrences': len(tokens), 'occurrencesWithAgreedMacrons': sum(key(word) in entries for word in tokens if word.isascii()), 'ambiguousWordForms': len(ambiguous), 'unmappedOrRejectedWordForms': len(rejected), 'vocabularyWordForms': len(vocabulary)},
        'sourceFiles': source_files,
        'reviewStatus': 'Automatic dictionary agreement; not a human-proofread macronized edition. Unmarked vowels are not necessarily short.',
    }
    (ROOT / 'corpus-source/macrons/receipt.json').write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + '\n')
    (ROOT / 'public/macrons/receipt.json').write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + '\n')
    (ROOT / 'public/macrons/LICENSE').write_bytes((ROOT / 'corpus-source/macrons/LICENSE').read_bytes())
    print(json.dumps({'lexicon': receipt['lexicon'], 'coverage': receipt['coverage']}, indent=2))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    build(Path(sys.argv[1]))
