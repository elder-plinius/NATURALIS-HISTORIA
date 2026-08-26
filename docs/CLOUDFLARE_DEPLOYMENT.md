# Cloudflare deployment from GitHub

This is a vinext Worker with static assets; do not use the legacy static Pages
workflow.

## External state at the release-candidate audit

As of 24 August 2026, `elder-plinius/naturalis-historia` has not yet been
created as a public repository, and `naturalishistoria.org` does not resolve in
public DNS. The repository URL and origin in source are intended destinations,
not receipts that either external resource exists. Repository creation, DNS
configuration, Worker/domain binding, and post-deploy edge verification remain
manual owner actions.

## Create the canonical repository

The checked public-repository ZIP may be created before DNS exists because it
is the input to repository setup. Packaging proves local security, rights, and
artwork coverage only; it never substitutes for the live `npm run
release:check` required by the production build below.

GitHub's browser uploader does not unpack a ZIP and only accepts 100 files per
upload. Extract the release ZIP locally, then use GitHub Desktop or Git:

```sh
git init
git add .
git commit -m "Publish Naturalis Historia living codex"
git branch -M main
git remote add origin git@github.com:elder-plinius/naturalis-historia.git
git push -u origin main
```

Protect `main` and require the CI workflow before merging.

## Connect Workers Builds

1. In the Cloudflare dashboard, open **Workers & Pages** and create/import an
   application from GitHub.
2. Select `elder-plinius/naturalis-historia`.
3. Use build command `npm run release:build`. This is intentionally blocked
   while any public-release or independent-artwork gate is open.
4. Use deploy command `npm run deploy:built`. Do not replace these commands
   with raw `vinext build` or `wrangler deploy` calls that bypass the gates.
5. Leave the root directory at `/`.
6. Ensure the Worker name is `naturalis-historia`, matching `wrangler.jsonc`.
7. Deploy previews for pull requests and production from `main` only.
8. Attach the intended custom domain after DNS ownership is confirmed.

Before enabling production builds, confirm the canonical domain actually
resolves:

```sh
npm run release:domain
```

After the first deployment, request `https://naturalishistoria.org/`,
`/robots.txt`, and `/sitemap.xml` at the public edge. Confirm a successful HTTPS
response, the canonical URL, the expected security headers, and a robots policy
that advertises `https://naturalishistoria.org/sitemap.xml`. A configured origin
in source is not proof of DNS ownership, propagation, or edge deployment.

Local release checks:

```sh
npm ci
npm run check
npm run build
npm run deploy:dry-run
npm run release:check
```

The first four commands establish technical deployability. The final command
is the publication decision and must pass before connecting or enabling the
production branch. `npm run deploy` runs both the release build and deployment
when operating outside Workers Builds.
