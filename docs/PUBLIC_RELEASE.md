# Public release checklist

External launch state at the 26 August 2026 audit: the canonical public GitHub
repository exists. Publication is not yet claimed: a fresh, audited release
pull request must be reviewed and merged, the Cloudflare Worker build must be
linked to that repository, and the custom-domain DNS/edge gate must pass before
the canonical URL is announced.

- [x] Before public extraction, the complete-checkout `npm ci` and `npm run
      check` passed with all 1,065 accepted chapter-scene masters present,
      recording distinct source hashes plus decode, geometry, and perceptual-
      distinctness receipts.
- [x] `npm ci`, public-profile `npm run check`, build, and Wrangler dry run pass
      from a fresh extracted public-repo archive. Its authenticated prebuilt
      check verifies generated derivatives/provenance but does not claim to
      re-run the omitted-master perceptual test.
- [ ] Before any production build or deployment, `npm run release:check`
      passes, including the live canonical-domain DNS gate; packaging success
      alone is not publication authorization.
- [x] Exactly two active non-chapter plates and one social card have creator,
      rights holder, license, SHA-256, and receipt evidence; the Vesuvius plate
      exposes exactly four source-bound editorial crops.
- [x] The illustration claim matches `docs/ILLUSTRATION_COVERAGE.md`: all 1,065
      chapter illustrations are independently generated standalone masters,
      no atlas-cell library, route, or derivative is shipped, and no crop is
      described as an independent artwork.
- [x] `npm run release:domain` resolves the intended custom domain. The current
      HTTPS edge still serves a placeholder Worker, so this proves routing only,
      not publication of the edition.
- [ ] After production deployment, the canonical URL, `/robots.txt`, and
      `/sitemap.xml` are smoke-tested against the public edge.
- [ ] Public indexing, canonical links, sitemap, and security headers are
      verified at the production edge.
- [x] Narration is absent from the initial launch source and bundle; its API,
      allowlist, provider code, static-audio paths, and environment controls are
      excluded rather than left dormant in production.
- [x] The `public-repo` archive excludes `.git`, `.openai`, environment files,
      dependencies, build output, raw downloads, archived unused plates, all
      chapter-scene source PNGs, and all chapter-scene reject evidence while
      retaining receipts, manifests, code, and generated public derivatives.
- [x] Its production visual topology is exact: 1,065 chapter scenes, two active
      non-chapter plate masters, four Vesuvius crops, one social card, and zero
      atlas-cell records or delivery files. Retired build experiments and
      migration-only inventories are absent.
- [ ] Archive integrity test, SHA-256, extracted test receipt, and source commit
      are recorded.
- [ ] The exact archive is scanned for private keys, provider-token patterns,
      absolute home-directory paths, private Sites markers, and excluded paths.
- [ ] The deployable archive was produced by `npm run release:package:public --
      --output <zip> --smoke`, not by the all-in-one preservation profile or an
      ad hoc filesystem copy. Its authenticated profile records that local
      packaging preflight passed and that the live publication gate was not
      evaluated by the packager. If the input was an authenticated
      public-prebuilt checkout, it truthfully records zero locally excluded
      source files/bytes and no source-asset manifest.
The next three items are an optional, non-blocking preservation track for a
maintainer holding the complete source snapshot; they are not public-repository
launch gates:

- [ ] In the separate complete checkout, after the source tree was frozen,
      `npm run release:package:source-assets --
      --output-dir <directory> --smoke` produced all accepted-master and
      reject-evidence parts. Every ZIP is at most 1.5 GB, has an independent
      `.sha256`, and appears in the checksummed machine-readable manifest.
- [ ] A clean rehydration of every source-asset part passes `npm run
      release:verify-source-assets -- <manifest> --root <checkout>` with no
      missing, extra-assigned, size-mismatched, or digest-mismatched file.
- [ ] After rehydration, `npm run test:chapter-scenes` passes against the restored
      preservation-master bytes.
- [ ] No packaging command ran while `public/assets` or chapter-scene sources
      were changing. If a review artifact used `--hold`, every archive retained
      its generated `RELEASE-HOLD.txt`; `--hold` never bypassed a local security,
      rights, or artwork gate.
- [ ] `main` is protected and GitHub private vulnerability reporting is enabled.
