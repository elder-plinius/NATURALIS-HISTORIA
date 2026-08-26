# Editorial plate masters

The JPEG files in `plates/` are preservation masters for the modern editorial illustrations used by the reader. They are intentionally outside `public/` and are not deployed directly.

`npm run build:assets` derives content-hashed AVIF, WebP, and compact MozJPEG compatibility variants, writes the runtime source map and CSS variables, and emits a public provenance ledger. The filename hash includes the encoder-pipeline revision so changing Sharp or an encoding recipe cannot silently reuse an obsolete derivative.

`plates-provenance.json` and `og-provenance.json` record the active generation receipts. `asset-rights.json` is the separate source of truth for release clearance: every active plate, every chapter scene, and the social card must have an explicit source-bound record, and cleared records require a holder, license, evidence, and the exact SHA-256 of the licensed source bytes. The production tree retains exactly two non-chapter plate masters—the dedication and the four-panel Vesuvius afterword source—plus the social card. Retired atlas experiments and their derivatives are deliberately absent.

`chapter-scenes-v1/` contains the newer one-chapter/one-source production
campaign. These are full 1536×1024 illustrations, not crops or atlas panels.
`chapter-scenes-v1/STYLE_CONTRACT.md` defines the binding Plinian material
language, the controlled subject-family dialects, and the visual acceptance
gate used across every wave.
Each wave keeps its exact prompt, returned built-in output artifact, source hash,
and visual-QA notes in `receipt.json`. `npm run compile:chapter-scenes` validates
and combines those wave receipts into `chapter-scenes-provenance.json`, adds
source-bound AGPL-3.0 rights records, and refuses duplicate hashes or generation
evidence. `npm run build:assets` then emits responsive delivery files and the
runtime source map without deploying the PNG preservation masters.

Generation receipts use portable `built-in-imagegen://exec-….png` references
plus the artifact ID and SHA-256. Workstation home-directory paths must never
be committed to a receipt or emitted public provenance file.

Public-repository packaging deliberately leaves the chapter-scene PNG masters
and `evidence/` histories out of the deployable repository archive while
retaining each wave's `receipt.json`, compiled manifests, code, and generated
files under `public/assets/`. An authenticated public-prebuilt checkout has no
local source assets to exclude or inventory, so repackaging it records zero
excluded files/bytes and no companion source-asset manifest. Run `npm run
release:package:source-assets` only from the frozen complete checkout that still
contains the accepted masters and reject evidence. It emits separately
checksummed parts plus a machine-readable path/SHA-256/bundle manifest, so the
actually packaged local evidence can be rehydrated byte-for-byte without
putting multi-gigabyte preservation masters in Git history.

`chapter-artwork-plan.json` is the complete 1,065-row production ledger;
`chapter-artwork-manifest.json` contains only certified one-to-one assignments.
Run `npm run plan:artwork` after compiling a wave. The strict coverage audit
counts source art only—it never counts crops, panels, reframings, or responsive
formats as additional illustrations.
