# Public release checklist

External launch state at the 24 August 2026 audit: the intended GitHub
repository is not public and the intended custom domain is NXDOMAIN. References
to those URLs in source describe the target architecture, not a completed
publication.

- [ ] Before packaging, `npm ci` and the complete-checkout `npm run check` pass
      while every accepted chapter-scene master is present; this is the
      source-byte, geometry, and perceptual-distinctness receipt.
- [ ] `npm ci`, public-profile `npm run check`, build, and Wrangler dry run pass
      from a fresh extracted public-repo archive. Its authenticated prebuilt
      check verifies generated derivatives/provenance but does not claim to
      re-run the omitted-master perceptual test.
- [ ] Before any production build or deployment, `npm run release:check`
      passes, including the live canonical-domain DNS gate; packaging success
      alone is not publication authorization.
- [x] All active plates and the social card have creator, rights holder,
      license, SHA-256, and receipt evidence.
- [ ] The illustration claim matches `docs/ILLUSTRATION_COVERAGE.md`; no crop is
      described as an independent artwork.
- [ ] `npm run release:domain` resolves the intended custom domain; the public
      HTTPS edge, canonical URL, `/robots.txt`, and `/sitemap.xml` are then
      smoke-tested after deployment.
- [ ] Public indexing, canonical links, sitemap, and security headers are
      verified at the production edge.
- [x] Narration is absent from the initial launch source and bundle; its API,
      allowlist, provider code, static-audio paths, and environment controls are
      excluded rather than left dormant in production.
- [ ] The `public-repo` archive excludes `.git`, `.openai`, environment files,
      dependencies, build output, raw downloads, archived unused plates, all
      chapter-scene source PNGs, and all chapter-scene reject evidence while
      retaining receipts, manifests, code, and generated public derivatives.
- [ ] Archive integrity test, SHA-256, extracted test receipt, and source commit
      are recorded.
- [ ] The exact archive is scanned for private keys, provider-token patterns,
      absolute home-directory paths, private Sites markers, and excluded paths.
- [ ] The deployable archive was produced by `npm run release:package:public --
      --output <zip> --smoke`, not by the all-in-one preservation profile or an
      ad hoc filesystem copy. Its authenticated profile records that local
      packaging preflight passed and that the live publication gate was not
      evaluated by the packager.
- [ ] After the source tree was frozen, `npm run release:package:source-assets --
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
