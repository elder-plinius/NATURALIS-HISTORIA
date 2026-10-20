# Partial dictionary macrons

This is an opt-in reading aid, not a replacement or correction of Mayhoff's text.
No contextual analysis or part-of-speech model is run. The pinned Alatius
`macrons.txt` supplies several morphological analyses for many spellings.
Only long-vowel positions shared by **all** supplied analyses are retained.
Uncertain `_ ^` quantities (written `_^` in the source), invalid/unmapped
analyses, and unknown words cannot introduce a macron. i/j and u/v are normalized
only for lookup; the displayed spelling, capitalization, spacing and punctuation
are preserved. Existing diacritics, Roman numerals and short capitalized
abbreviations are left as supplied.

The aid covers Latin reading passages and titles in the 37 books and the two
Vesuvius letters. It does not annotate editorial plate captions or English.
An unmarked vowel is not evidence of short quantity. Dictionary agreement is
not a substitute for proofreading, especially in proper names and rare forms.

`receipt.json` records exact source and corpus hashes. Download `source.url`
from that receipt to a local file, verify `source.sha256`, then regenerate:

```sh
python3 scripts/build-macrons.py /path/to/macrons.txt
npm run test:macrons
npm run release:refresh-manifest
npm run check
```

The 32 MB upstream input is not bundled. The corpus-specific subset is shipped
locally and loaded only on the reader's request; its bytes and hash are checked
before use. Generation makes no network requests. Keep the upstream GPL v3
licence and NOTICE attribution with the subset. Read `/edition#macrons` for the
reader-facing explanation.
