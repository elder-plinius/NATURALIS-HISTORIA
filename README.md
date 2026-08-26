# Naturalis Historia — The Living Codex

An open, bilingual reading edition of all thirty-seven books of Pliny the
Elder's *Naturalis Historia*. The reader preserves the Latin, presents the
historical Bostock–Riley English translation, and lets the page move from one
language to the other through a deliberately material ink-diffusion effect.

The project contains 1,065 reading units, full-text keyword search, responsive
antiquarian plates, keyboard and history navigation, focus mode, accessible
reduced-motion behavior, and a clearly separated Vesuvius afterword containing
Pliny the Younger's letters VI.16 and VI.20.

## Release status

This checkout is a public-source release candidate. The complete local software
suite passes, but it is intentionally **on hold for public deployment** until
the owner creates the external repository, configures the custom domain, and
the live DNS/edge gate passes. At this candidate's audit point:

- All 47 active plate masters and the social card have explicit source-hash-bound
  rights records. The 31 legacy masters were reconciled to completed ImageGen
  receipts and byte-exact source conversions on 26 August 2026.
- The strict artwork gate records all 1,065 assigned source-art illustrations:
  978 standalone full-scene masters plus 87 independently composed cells from
  16 receipt-backed six-cell atlases. The certified manifest assigns each
  illustration to exactly one reading unit; the remaining gap is zero.
- All 978 standalone masters are byte-identical to their accepted built-in
  ImageGen originals, have distinct SHA-256 hashes, and pass the permanent
  decode, geometry, and perceptual-distinctness verifier.

The illustration counts deliberately distinguish source art from delivery
files:

- The atlas library contains 96 distinct declared cell compositions inside 16
  source atlas files; 87 are assigned to chapters. Nine superseded cells remain
  preserved and certified but intentionally unused rather than being forced
  onto semantically unrelated chapters. They are not described as separate
  original PNG files.
- Responsive AVIF, WebP, and JPEG derivatives, crops, captions, and layouts never
  increase the 1,065 source-art count.
- The 47 legacy folio plates remain a separately documented asset library and
  are not used to inflate the chapter-assignment total.

See [the illustration coverage note](docs/ILLUSTRATION_COVERAGE.md) for the
machine-checked claim boundary.

## Local development

Requirements: Node.js 22.13.x and npm 10.9.x. The checked-in `.nvmrc`,
`packageManager` field, and npm lockfile define the release toolchain.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. The complete verification suite is:

```sh
npm run check
```

For an ordinary technical build and Cloudflare Worker dry run:

```sh
npm run build
npm run deploy:dry-run
```

The publication path is deliberately stricter:

```sh
npm run release:check
npm run deploy
```

`npm run deploy` refuses to build or publish while any public-rights,
independent-artwork, release-security, or provenance gate remains open.

Create the deployable public-repository archive only through its explicit
profile, after all asset generation has stopped and the release candidate is
frozen:

```sh
npm run release:package:public -- --output outputs/releases/naturalis-historia-1.0.0-public-repo.zip --smoke
npm run release:package:source-assets -- --output-dir outputs/releases --smoke
```

Packaging is deliberately possible before the external repository and custom
domain exist: the repository ZIP is an input to that setup. Every packaging
profile first runs the non-bypassable local security, public-rights, and
independent-artwork gates. The packager does **not** claim publication
authorization or test live DNS; `npm run release:check` remains mandatory before
any production build or deployment and includes the canonical-domain gate.

The `public-repo` profile retains code, receipts, manifests, and generated
public derivatives while excluding every chapter-scene preservation PNG and
the corresponding local reject-evidence directories. The `source-assets`
profile preserves those excluded files in separate accepted-master and
reject-evidence parts. Parts target 1.35 GB of source bytes and are rejected if
the resulting ZIP exceeds 1.5 GB, comfortably below GitHub's 2 GiB per-release-
asset ceiling. Every part has its own `.sha256`; the generated
`source-assets.manifest.json` and checksum map every excluded path to its exact
SHA-256 and bundle filename.

The public archive carries an authenticated `RELEASE-PROFILE.json`. When all
chapter-scene masters are intentionally absent under that profile, CI and the
asset prebuild verify the committed source-hash/pipeline-bound derivatives and
public provenance rather than trying to regenerate them. A partial master set
is always an error. The source-level byte, geometry, and perceptual-distinctness
test remains mandatory in the complete checkout before packaging and runs
again after source-asset rehydration; the public-repo fallback is not evidence
that the omitted masters were re-tested in GitHub or Cloudflare.

The unchanged default `npm run release:package` profile is now named
`comprehensive-source`. It preserves the previous all-in-one source selection,
including masters and reject evidence, for local preservation workflows; it is
not the archive to populate the public repository and may exceed GitHub's
per-asset limit.

All profiles select tracked and intentional untracked source through Git where
appropriate, exclude credentials, caches, build products and nested archives,
use streamed hashing, add file manifests, integrity-test each ZIP, and emit
external checksums. The source-asset profile also walks local chapter-scene
evidence directly so ignored evidence cannot disappear silently. Packaging
fails if a selected file, its metadata, or the selected path set changes before
the run finishes, and temporary staging is always removed. Do not run any
profile while `public/assets` or chapter-scene source is still changing.

After downloading all source-asset parts beside their manifest and checksum
files, verify them from that directory, extract every part into the parent of
the checkout, then verify the rehydrated bytes:

```sh
shasum -a 256 -c ./*.sha256
for archive in ./naturalis-historia-1.0.0-source-assets-*.zip; do unzip -q "$archive" -d /path/to/checkout-parent; done
npm run release:verify-source-assets -- ./naturalis-historia-1.0.0-source-assets.manifest.json --root /path/to/checkout-parent/naturalis-historia
```

The packager refuses to package while any local packaging gate fails, and
`--hold` cannot bypass one. Maintainers may still request explicitly labeled,
non-publishable review artifacts with `--hold`; every resulting archive then
contains `RELEASE-HOLD.txt`. A normal package without that marker is safe to
review and upload, but is not by itself a live-publication receipt.

## Deployment

The app uses the vinext Cloudflare runtime, so the correct Git-connected target
is **Workers Builds with Static Assets**, not legacy static Pages. See
[Cloudflare deployment](docs/CLOUDFLARE_DEPLOYMENT.md).

The canonical public repository is intended to be
[`elder-plinius/naturalis-historia`](https://github.com/elder-plinius/naturalis-historia).
At this release-candidate audit, that repository and the custom-domain DNS are
still pending external owner setup; configured URLs are not publication
receipts.

## Editorial sources

- Latin: Mayhoff's 1906 edition through the Perseus Digital Library,
  `canonical-latinLit`, pinned by commit and SHA-256 receipt. The derived Latin
  data remains CC BY-SA 4.0.
- English: John Bostock and H. T. Riley, 1855–57, from six Project Gutenberg
  volumes identified as public domain in the United States.
- Vesuvius afterword: Pliny the Younger, *Epistulae* VI.16 and VI.20, kept
  outside the thirty-seven-book corpus count.

The generated [corpus manifest](public/corpus/manifest.json),
[correction ledger](public/corpus/corrections.json), and
[provenance ledger](public/provenance.json) carry the detailed receipts.

## License

Original project code and project-authored material are licensed under the
[GNU Affero General Public License v3.0 only](LICENSE), except where a file or
source notice states otherwise. Perseus-derived text remains CC BY-SA 4.0;
historical translations retain their source-specific public-domain and
Project Gutenberg notices. See [NOTICE.md](NOTICE.md).

## Contributing

Corrections and improvements are welcome. Start with
[CONTRIBUTING.md](CONTRIBUTING.md); corpus, provenance, illustration-routing,
and deployment changes receive especially careful review.
