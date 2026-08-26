# Illustration coverage and claim ceiling

The reader contains 1,065 chapter routes. Source illustrations, editorial
crops, and responsive delivery files are different measures and must not be
collapsed into one marketing number.

| Measure | Current count | What it means |
| --- | ---: | --- |
| Chapter routes | 1,065 | Every bilingual reading unit has an illustration |
| One-to-one full chapter scenes | 1,065 | Standalone 1536×1024 source PNGs, one accepted generation and one source hash per chapter |
| Verified one-to-one assignments | 1,065 | `chapter-artwork-manifest.json` binds every standalone scene to exactly one chapter |
| Runtime chapter compositions | 1,065 | Every route renders its complete illustration as a single-panel hero |
| Supplementary plate masters | 2 | The dedication cover and the four-panel Vesuvius opening tableau |
| One-to-one Vesuvius folio illustrations | 12 | Standalone 1536×1024 source PNGs, one accepted generation and one source hash for each reading folio |
| Atlas-cell library, routes, and derivatives | 0 | Retired atlas-cell build experiments are not production inventory |
| Responsive chapter-scene derivatives | 4,260 | Four delivery assets for each standalone chapter scene |
| Responsive non-chapter derivatives | 56 | Eight complete-plate files plus forty-eight one-to-one Vesuvius folio files |
| Social card | 1 | One separately receipted 1200×630 source image, delivered as `/og.jpg` |

The exact public illustration payload is therefore 4,316 files under
`public/assets/`: 4,260 chapter-scene derivatives, eight derivatives for the
two supplementary plates, and forty-eight derivatives for the twelve Vesuvius folios. The
social card is a separate root asset. The public ledger and verifier reject
extra public files, inactive plate masters, repeated Vesuvius crop delivery,
atlas-cell metadata, atlas-cell routes, and atlas-cell derivatives.

The earlier crop-routing system is retired. The current manifest contains
exactly 1,065 standalone chapter-scene assignments, with no legacy-curated,
title-match, subheading-match, taxonomy-fallback, generic-fallback, or
atlas-cell route. A resize, crop, zoom, caption, or layout never creates another
source illustration.

The 1,065 full-scene masters are all decodable, opaque 1536×1024 sRGB PNGs.
Each has a unique SHA-256, and the complete-checkout verifier checks both exact
hashes and pairwise perceptual separation. Each accepted chapter receipt also records
direct byte-buffer equality between the repository master and its built-in
ImageGen original. The deployable public profile intentionally omits those
heavy chapter preservation PNGs and reject histories after authenticating their
committed derivatives and provenance; they belong in the separate source-asset
release, not the production repository. The much smaller twelve-image Vesuvius
folio set remains source-visible with exact prompts, source hashes, and visual-QA
notes so its one-to-one afterword claim can be audited directly.

## Strict 1,065-artwork target

The strict target requires every route to have a distinct source artwork with:

- a stable chapter key and subject brief;
- an original master file and SHA-256;
- creator, tool or commission, rights holder, and license;
- generation or commission receipt;
- visual review for subject accuracy, framing, text artifacts, anatomy, and
  continuity with the house style;
- a one-to-one assignment in a committed artwork manifest.

The current repository meets that assignment target: 1,065/1,065, with zero
unassigned or multiply assigned illustrations. It supports the precise claim
“1,065 unique original illustrations”: every one is an independently generated
standalone source PNG with its own prompt, hash, receipt evidence, visual-QA
note, and one-to-one chapter assignment.

The coherent house style remains: iron-gall line, cross-hatching and stipple,
restrained mineral color on warm vellum, complete subjects, generous breathing
room, no pseudo-writing, and no glossy modern rendering. Controlled variation
is intentional: cosmos, geography, and animals may use airy geometry and lapis
depth; trees, agriculture, and materia medica may become more intimate and
herbarium-like; medicine, minerals, and arts may use stronger chiaroscuro and
mineral accents. Vellum, line, pigment restraint, framing discipline, and
material texture bind the dialects into one edition.
