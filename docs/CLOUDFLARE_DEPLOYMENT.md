# Cloudflare deployment from GitHub

This is a vinext Worker with static assets; do not use the legacy static Pages
workflow.

## External state at the prelaunch audit

As of the latest 26 August 2026 check, `naturalishistoria.org` resolves through
Cloudflare and answers HTTPS, but it serves the placeholder response `Hello
world`, not this edition. DNS reachability is therefore established; a
successful production build and post-deploy edge verification are not.

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
3. Use build command `npm run check`. It runs the complete technical suite and
   leaves the vinext build in `dist/` for either deployment path.
4. Use production deploy command `npm run deploy:production`. It runs the live
   publication gates, then deploys `dist/server/wrangler.json` without rebuilding.
5. Use non-production branch deploy command `npm run deploy:preview`. The
   standard `npx wrangler versions upload` also works: the root
   `wrangler.jsonc` now targets the built Worker, while `wrangler.source.jsonc`
   is reserved for vinext's build input.
6. Leave the root directory at `/` and set the production branch to `main`.
7. Ensure the Worker name is `naturalis-historia`, matching `wrangler.jsonc`.
8. Enable non-production branch builds when PR preview checks are wanted.
9. Attach the intended custom domain after DNS ownership is confirmed.

The three dashboard command fields are deliberately different:

| Workers Builds field | Command | Purpose |
| --- | --- | --- |
| Build command | `npm run check` | Verify and create `dist/` on every branch |
| Deploy command | `npm run deploy:production` | Gate and promote production |
| Non-production branch deploy command | `npm run deploy:preview` | Upload an unpromoted PR preview from the built config |

Cloudflare's default `npx wrangler deploy` and `npx wrangler versions upload`
are supported as fallbacks. The root config runs `npm run build` itself when
Cloudflare's optional build-command field is empty, then deploys `dist/`. The
commands above remain preferred because production gets the publication gate
and both paths use the exact config vinext generated.

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
npm run deploy:preview:dry-run
npm run deploy:workers-builds:dry-run
npm run deploy:workers-builds-preview:dry-run
npm run release:check
```

The dry runs establish both production and preview deployability. The final
command is the publication decision and must pass before production promotion.
`npm run deploy` remains the all-in-one local release path. Workers Builds
should use the branch-specific commands above because it separates build from
deploy; its native defaults are now tested compatibility paths rather than
unverified assumptions.
