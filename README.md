# NATVRALIS HISTORIA

## The whole world, illustrated again.

**XXXVII books · 1,065 bilingual chapters · 1,065 original AI-generated illustrations**

Pliny tried to gather the world into a book: stars, seas, elephants, pigments,
medicines, monsters, memory, gossip. We have given every chapter a window.

This is a complete open reader for Pliny the Elder's *Naturalis Historia*, with
Mayhoff's Latin and the historical Bostock–Riley English translation. The Latin
arrives first. English diffuses through it like fresh ink. Search the whole
work, follow the index, move by history, or let Fortuna open a page when reason
has had enough.

And yes—we made **1,065 illustrations with AI**, one independently generated
1536×1024 scene for every reading unit. No recycled atlas. No shuffled crops.
No arithmetic tricks. Each image was prompted for its chapter, reviewed,
hashed, receipted, and assigned exactly once.

The result is part edition, part instrument, part impossible recovered codex:
rough as vellum, precise as type, alive as ink.

## What lives here

- all thirty-seven books in 1,065 complete Latin–English reading units;
- 1,065 one-to-one AI-generated chapter plates, plus a small documented set of
  non-chapter art;
- full-work positional search, index, previous/next history, and Fortuna;
- selectable text, responsive layouts, focus mode, fullscreen plates, and
  reduced-motion support;
- Pliny the Younger's accounts of Vesuvius, *Epistulae* VI.16 and VI.20, kept
  beyond the Elder's corpus as a clearly marked afterword.

The pictures carry no textual authority. The Latin and English remain real,
selectable text. Wonder is welcome here; confusion about the evidence is not.

## Open the codex

Use Node.js 22.13.x and npm 10.9.x:

```sh
npm ci
npm run dev
```

Then open `http://localhost:3000`.

To test the whole edition:

```sh
npm run check
npm run deploy:dry-run
```

`npm run check` verifies the corpus, translation alignment, search, artwork
assignments, provenance, accessibility-sensitive reader effects, release
security, packaging invariants, and production build. The stricter
`npm run release:check` also requires the live publication gates.

## Deploy through Workers Builds

Do not keep Cloudflare's inferred defaults. Configure the Git-connected Worker
with these exact commands:

- **Build command:** `npm run check`
- **Deploy command:** `npm run deploy:production`
- **Non-production branch deploy command:** `npm run deploy:preview`
- **Root / production branch:** `/` and `main`

The preview override matters. Cloudflare otherwise runs a generic `wrangler
versions upload` against the source configuration; this project must upload the
built vinext configuration at `dist/server/wrangler.json`. Production alone
runs the DNS and publication gates before deploying those same built bytes.

## Receipts, because marvels require witnesses

Every chapter plate has a source hash, generation record, rights record, and
one-to-one manifest assignment. Responsive AVIF, WebP, and JPEG files are
delivery forms, not extra artworks. The public repository retains code,
manifests, receipts, and deployable derivatives; heavy preservation masters
and rejected generations belong to the separately verified source archive.

- [Illustration coverage and exact claim boundary](docs/ILLUSTRATION_COVERAGE.md)
- [Public release checklist](docs/PUBLIC_RELEASE.md)
- [Cloudflare deployment](docs/CLOUDFLARE_DEPLOYMENT.md)

This tree is the version 1.0.0 reviewed source input. It is not evidence that
the configured domain is live. Publication still requires a merged commit and
verified DNS, HTTPS, canonical URLs, indexing, and edge headers.

## Texts and license

- **Latin:** Mayhoff, 1906, via the Perseus Digital Library; derived data is CC
  BY-SA 4.0.
- **English:** John Bostock and H. T. Riley, 1855–57, from the public-domain
  Project Gutenberg volumes.
- **Project code and project-authored material:**
  [AGPL-3.0-only](LICENSE), except where a source notice says otherwise.

See [NOTICE.md](NOTICE.md) and the public [provenance ledger](public/provenance.json)
for the long memory.

## Contributing

Corrections are welcome. Bring evidence, preserve the source, and do not sand
away the strangeness. Start with [CONTRIBUTING.md](CONTRIBUTING.md).
