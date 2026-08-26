# Illustration coverage and claim ceiling

The reader contains 1,065 chapter routes. Several different measures describe
its visuals, and they must not be collapsed into one marketing number.

| Measure | Current count | What it means |
| --- | ---: | --- |
| Chapter routes | 1,065 | Every bilingual reading unit has a plate |
| Legacy/master folio plates | 47 | Source JPEG folios in `assets-source/plates/` |
| Receipt-backed six-cell atlases | 16 | Generated campaigns with tool receipts and six declared cells each |
| Certified atlas-cell library | 96 | Six independently composed, declared cells across each of the 16 generated atlases |
| Assigned atlas-cell illustrations | 87 | Receipt-backed cells with one semantically appropriate chapter route each |
| Preserved, available-unused atlas cells | 9 | Superseded cells retained with receipts and derivatives, never force-routed to unrelated chapters |
| One-to-one full chapter scenes | 978 | Standalone 1536×1024 source PNGs, one accepted generation and one source hash per assigned chapter |
| Total assigned source-art illustrations | 1,065 | 87 atlas cells plus 978 standalone full scenes; no crops, layouts, unused cells, or derivatives added to this count |
| Full-screen cell-library derivatives | 288 | AVIF, WebP, and JPEG files preserving the complete 512×512 source bounds of all 96 receipt-backed studies; 261 belong to the 87 assigned cells |
| Responsive full-scene derivatives | 3,912 | Four delivery assets for each of the 978 standalone chapter scenes |
| Runtime chapter compositions | 1,065 | Every route renders one complete, single-panel hero composition |
| Verified one-to-one chapter assignments | 1,065 | `chapter-artwork-manifest.json` binds every certified illustration to one chapter exactly once |

All 47 folio masters now have source-hash-bound generation and rights records.
The 31 recovered legacy receipts clear those masters for the owner-directed
AGPL-3.0 release, but do not promote them into the 16 certified six-cell
atlases or increase the 1,065 certified chapter illustrations.

The previous 991/1,065 figure measured distinct crop geometry, not original art.
That interim routing system has been retired from chapter presentation. The
current manifest contains exactly 978 full-scene routes and 87 certified
atlas-cell routes, with no legacy-curated, title-match, subheading-match,
taxonomy-fallback, or generic fallback route. Every route uses the complete
assigned illustration in a single-panel hero, and every fullscreen atlas link
preserves the bounds of its declared source cell.

The 978 full-scene masters are all decodable, opaque 1536×1024 sRGB PNGs. Each
has a unique SHA-256, and the permanent verifier checks both exact hashes and
pairwise perceptual separation. Each accepted receipt also records direct
byte-buffer equality between the repository master and its built-in ImageGen
original. All 96 atlas cells retain their receipt, atlas identifier, declared
cell, and bounded extraction path. The nine available-unused cells are excluded
from the route count and documented explicitly in the certified manifest.

Delivery files remain a separate claim. AVIF, WebP, and JPEG encodes improve
loading and fullscreen viewing, but a resize, crop, zoom, caption, or panel
arrangement never creates another source illustration.

## Strict 1,065-artwork target

The strict target requires every route to have a distinct source artwork or
independently composed study with:

- a stable chapter key and subject brief;
- an original master file and SHA-256;
- creator, tool or commission, rights holder, and license;
- generation or commission receipt;
- visual review for subject accuracy, framing, text artifacts, anatomy, and
  continuity with the house style;
- a one-to-one assignment in a committed artwork manifest.

The current repository meets that assignment target: 1,065/1,065, with zero
unassigned or multiply assigned illustrations. This supports the precise claim
“1,065 unique original illustrations” when the atlas-cell qualification above
is kept available; it does not support the different claim that there are
1,065 standalone source PNG files.

The coherent house style remains: iron-gall line, cross-hatching and stipple,
restrained mineral color on warm vellum, complete subjects, generous breathing
room, no pseudo-writing, and no glossy modern rendering. Controlled variation
is intentional: cosmos, geography, and animals may use airy geometry and lapis
depth; trees, agriculture, and materia medica may become more intimate and
herbarium-like; medicine, minerals, and arts may use stronger chiaroscuro and
mineral accents. Vellum, line, pigment restraint, framing discipline, and
material texture bind the dialects into one edition.
