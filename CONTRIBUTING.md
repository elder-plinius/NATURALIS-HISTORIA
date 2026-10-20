# Contributing

Thank you for helping make Pliny's work more accurate, legible, and alive.

## Before opening a pull request

1. Create a focused branch from `main`.
2. Install with `npm ci`. After intentional changes, run
   `npm run release:refresh-manifest`, review the inventory diff, then run
   `npm run check` and commit the updated manifest alongside the source changes.
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

## Dependency maintenance

Keep exact dependency versions and the lockfile synchronized. Update Cloudflare
Wrangler, its Vite plugin, and worker types together when their peer requirements
change; do not bypass peer conflicts with force or legacy install flags.

GitHub Actions must retain full commit SHA pins. Review each new upstream commit
and its release notes; version comments are for readers, not a trust boundary.
The security verifier checks immutable pins and required controls instead of
hard-coding an old action release.

Run `npm run release:refresh-manifest` explicitly after intentional source or
dependency changes. It updates the inventory without modifying the release
profile. Review additions, removals, and hashes before committing; `npm run check`
continues to reject a stale manifest and never repairs it automatically. If the
build changes generated files, review those changes and refresh again. Finish
with the full check, the four deployment dry runs from CI, and
`npm audit --audit-level=high`.

Public-repository builds verify and preserve the shipped illustration derivatives
and encoder receipts. Updating Sharp must not re-encode reviewed plates during
a deploy. Deliberate art regeneration belongs in a separately reviewed source
release with synchronized provenance and no orphan derivatives.

The only file dependency is the reviewed private `braces` security backport.
Keep its source/installed hashes and adversarial regression gate intact.
Run `npm run test:dependency-security` and the full audit after any dependency
change. See `vendor/braces/SECURITY-BACKPORT.md` for exact patch provenance and
the procedure for returning to a fixed upstream release.
