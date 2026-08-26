# Contributing

Thank you for helping make Pliny's work more accurate, legible, and alive.

## Before opening a pull request

1. Create a focused branch from `main`.
2. Install with `npm ci` and run `npm run check`.
3. Keep generated outputs synchronized with their source files.
4. Do not add credentials, private deployment IDs, unlicensed media, or
   provider-generated artifacts without provenance receipts.

## Textual corrections

Include the reader URL, book and TEI chapter, language, a short quotation, the
source supporting the change, and the type of issue: source transcription,
extraction, alignment, historical translation, modern caption, or routing.

Verified source repairs belong in `corpus-source/corrections.json` and must be
regenerated through `scripts/build-corpus.py`. Do not silently modernize the
Latin or nineteenth-century English.

## Illustrations

Every proposed plate must include creator, rights holder, license, source or
generation receipt, master SHA-256, and a chapter-level subject rationale.
Repeated crops do not count as independent artworks. Changes to routing must
keep the subject, alt text, caption, crop bounds, and continuity tests aligned.

## Review-sensitive paths

Changes under `corpus-source/`, `assets-source/`, `app/illustrations.mjs`,
`edition-policy.json`, `wrangler.jsonc`, and `.github/` need maintainer review.
Pull requests may be held until their evidence is complete.
