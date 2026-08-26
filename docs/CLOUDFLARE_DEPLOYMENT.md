# Cloudflare deployment from GitHub

This is a vinext Worker with static assets; do not use the legacy static Pages
workflow.

## External state at the prelaunch audit

As of 26 August 2026, `elder-plinius/NATURALIS-HISTORIA` exists as the canonical
public repository. `naturalishistoria.org` did not resolve in public DNS at the
last prelaunch check. DNS configuration, Worker/domain binding, and post-deploy
edge verification therefore remain manual owner actions; the configured origin
in source is not evidence that the public edge is live.

## Merge the reviewed release

The checked public-repository ZIP is the authenticated input to the release PR.
Packaging proves local security, rights, and artwork coverage only; it never
substitutes for the live `npm run release:check` required by the production
build below. Review the PR's one-commit tree, require the CI workflow, and merge
only after its checks pass. Keep `main` protected from direct pushes.

## Connect Workers Builds

1. In the Cloudflare dashboard, open **Workers & Pages** and create/import an
   application from GitHub.
2. Select `elder-plinius/NATURALIS-HISTORIA`.
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
