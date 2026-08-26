import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const fail = (condition, message) => {
  if (!condition) failures.push(message);
};
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const packageJson = JSON.parse(read('package.json'));
const packageLock = JSON.parse(read('package-lock.json'));
const lockRoot = packageLock.packages?.[''] ?? {};

fail(packageJson.private === true, 'Package must remain private to prevent accidental npm publication.');
fail(packageJson.license === 'AGPL-3.0-only', 'Package license must be AGPL-3.0-only.');
fail(packageJson.packageManager === 'npm@10.9.2', 'Release npm version must remain pinned to 10.9.2.');
fail(packageJson.engines?.node === '>=22.13.0 <23', 'Release Node engine must remain within the tested Node 22 line.');
fail(packageJson.engines?.npm === '>=10.9.2 <11', 'Release npm engine must remain within the tested npm 10 line.');
fail(packageLock.lockfileVersion === 3, 'npm lockfile must use lockfileVersion 3.');
fail(lockRoot.license === packageJson.license, 'Lockfile root license is out of sync with package.json.');
fail(JSON.stringify(lockRoot.engines) === JSON.stringify(packageJson.engines), 'Lockfile root engines are out of sync with package.json.');

for (const group of ['dependencies', 'devDependencies']) {
  const declared = packageJson[group] ?? {};
  const locked = lockRoot[group] ?? {};
  fail(JSON.stringify(locked) === JSON.stringify(declared), `Lockfile root ${group} are out of sync with package.json.`);
  for (const [name, version] of Object.entries(declared)) {
    fail(
      typeof version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version),
      `${group} entry ${name} must use an exact registry version, not ${version}.`,
    );
  }
}

fail(packageJson.scripts?.['release:build'] === 'npm run release:check && npm run build', 'Release build must run publication gates before the build.');
fail(packageJson.scripts?.deploy === 'npm run release:build && npm run deploy:built', 'Default deploy must not bypass the release build.');
fail(packageJson.scripts?.['deploy:built']?.startsWith('node scripts/run-wrangler.mjs deploy '), 'Built deploy must use the telemetry-disabled Wrangler wrapper.');
fail(packageJson.scripts?.['deploy:production'] === 'npm run release:check && npm run deploy:built', 'Workers Builds production deploy must run publication gates before the built deploy.');
fail(packageJson.scripts?.['deploy:preview'] === 'node scripts/run-wrangler.mjs versions upload -c dist/server/wrangler.json', 'Workers Builds preview deploy must upload the built vinext configuration.');
fail(packageJson.scripts?.['deploy:preview:dry-run'] === 'node scripts/run-wrangler.mjs versions upload --dry-run -c dist/server/wrangler.json', 'Preview deploy must expose a dry-run verifier for CI.');
fail(packageJson.scripts?.['deploy:dry-run']?.startsWith('node scripts/run-wrangler.mjs deploy --dry-run '), 'Dry run must use the telemetry-disabled Wrangler wrapper.');
fail(packageJson.scripts?.['deploy:workers-builds:dry-run'] === 'node scripts/run-wrangler.mjs deploy --dry-run', 'Workers Builds production default must have an exact dry-run verifier.');
fail(packageJson.scripts?.['deploy:workers-builds-preview:dry-run'] === 'node scripts/run-wrangler.mjs versions upload --dry-run', 'Workers Builds preview default must have an exact dry-run verifier.');
fail(packageJson.scripts?.['release:package'] === 'node scripts/package-release.mjs', 'Release packaging must use the deterministic package script.');
fail(packageJson.scripts?.['release:package:public'] === 'node scripts/package-release.mjs --profile public-repo', 'Public-repository packaging must use the explicit public-repo profile.');
fail(packageJson.scripts?.['release:package:source-assets'] === 'node scripts/package-release.mjs --profile source-assets', 'Source-asset packaging must use the explicit source-assets profile.');
fail(packageJson.scripts?.['release:smoke'] === 'node scripts/smoke-release-archive.mjs', 'Release archive smoke must use the extracted-archive script.');
fail(packageJson.scripts?.['release:verify-source-assets'] === 'node scripts/verify-source-asset-bundles.mjs', 'Rehydrated source assets must have a manifest verifier.');
fail(packageJson.scripts?.['test:release-packaging'] === 'node scripts/verify-release-packaging.mjs', 'Release packaging invariants must have a non-archiving test command.');
fail(packageJson.scripts?.['build:assets'] === 'node scripts/build-assets.mjs', 'Asset builds must use the release-profile-aware wrapper.');

const envExample = read('.env.example');
fail(!/(?:OPENAI|OPENROUTER|ELEVENLABS|CARTESIA|NARRATION|SPEECH|SITES_TRUST)/u.test(envExample), 'Launch environment example must not expose held narration or legacy Sites controls.');
fail(!/NEXT_PUBLIC_[A-Z0-9_]*(?:KEY|SECRET|TOKEN)/u.test(envExample), 'Provider credentials must never use a NEXT_PUBLIC variable.');

const wrangler = JSON.parse(read('wrangler.jsonc'));
fail(wrangler.name === 'naturalis-historia', 'Cloudflare Worker name must be canonical.');
fail(wrangler.main === 'dist/server/index.js', 'Root Cloudflare config must deploy the built vinext Worker.');
fail(wrangler.compatibility_date === '2026-08-24', 'Cloudflare compatibility date changed without review.');
fail(Array.isArray(wrangler.compatibility_flags) && wrangler.compatibility_flags.length === 1 && wrangler.compatibility_flags[0] === 'nodejs_compat', 'Unexpected Cloudflare compatibility flags.');
fail(wrangler.no_bundle === true, 'Built vinext Worker must remain unbundled during Wrangler upload.');
fail(wrangler.assets?.directory === 'dist/client', 'Root Cloudflare config must upload the built client assets.');
fail(wrangler.build?.command === 'npm run build', 'Root Cloudflare deploy must create vinext output when Workers Builds omits its optional build command.');
fail(!wrangler.vars || Object.keys(wrangler.vars).length === 0, 'Public Wrangler config must not contain environment values or credentials.');

const wranglerSource = JSON.parse(read('wrangler.source.jsonc'));
fail(wranglerSource.name === wrangler.name, 'Cloudflare source and deploy configs must use the same Worker name.');
fail(wranglerSource.main === 'vinext/server/app-router-entry', 'Cloudflare source entry must remain the vinext app-router entry.');
fail(wranglerSource.compatibility_date === wrangler.compatibility_date, 'Cloudflare source and deploy compatibility dates must match.');
fail(JSON.stringify(wranglerSource.compatibility_flags) === JSON.stringify(wrangler.compatibility_flags), 'Cloudflare source and deploy compatibility flags must match.');
fail(!wranglerSource.vars || Object.keys(wranglerSource.vars).length === 0, 'Public Wrangler source config must not contain environment values or credentials.');

const viteConfig = read('vite.config.ts');
fail(viteConfig.includes("configPath: './wrangler.source.jsonc'"), 'Vite must build from the dedicated vinext source config.');

const nextConfig = read('next.config.ts');
const staticHeaders = read('public/_headers');
fail(nextConfig.includes("{ source: '/', headers: securityHeaders }"), 'Next security headers need an explicit bare-root rule for vinext.');
fail(nextConfig.includes("{ source: '/:path*', headers: securityHeaders }"), 'Next security headers need the descendant catch-all rule.');
const nextCsp = nextConfig.match(/key: 'Content-Security-Policy',\s*\n\s*value: "([^"]+)"/u)?.[1] ?? '';
const staticCsp = staticHeaders.match(/^\s*Content-Security-Policy:\s*(.+)$/mu)?.[1]?.trim() ?? '';
fail(Boolean(nextCsp), 'Next CSP could not be parsed.');
fail(nextCsp === staticCsp, 'Next and Cloudflare Static Assets CSP values have drifted.');
for (const directive of [
  "default-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "worker-src 'none'",
  'upgrade-insecure-requests',
]) {
  fail(nextCsp.includes(directive), `CSP is missing required directive: ${directive}.`);
}
for (const [name, value] of [
  ['Cross-Origin-Opener-Policy', 'same-origin'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains'],
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['X-Permitted-Cross-Domain-Policies', 'none'],
]) {
  fail(nextConfig.includes(`key: '${name}', value: '${value}'`), `Next config is missing ${name}.`);
  fail(staticHeaders.includes(`${name}: ${value}`), `Static Assets headers are missing ${name}.`);
}
fail(/\/assets\/\*[\s\S]*?Cache-Control: public, max-age=31536000, immutable/u.test(staticHeaders), 'Hashed assets must be immutable.');
fail(!staticHeaders.includes('/audio/'), 'Launch static headers must not expose a narration asset policy.');
fail(nextCsp.includes("connect-src 'self'"), 'Launch CSP must keep connections same-origin.');
fail(nextCsp.includes("media-src 'none'"), 'Launch CSP must disable unused media loading.');
fail(!nextCsp.includes('audio.naturalishistoria.org'), 'Launch CSP must not retain the held audio origin.');
fail(/\/corpus\/manifest\.json[\s\S]*?Cache-Control: public, no-cache, must-revalidate/u.test(staticHeaders), 'Corpus manifest must revalidate.');

const ci = read('.github/workflows/ci.yml');
for (const required of ['permissions:\n  contents: read', 'actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2', 'persist-credentials: false', 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0', 'node-version: 22.13.0', '- run: npm ci', '- run: npm run check', '- run: npm run deploy:dry-run', '- run: npm run deploy:preview:dry-run', '- run: npm run deploy:workers-builds:dry-run', '- run: npm run deploy:workers-builds-preview:dry-run', '- run: npm audit --audit-level=high']) {
  fail(ci.includes(required), `CI is missing required control: ${required.replaceAll('\n', ' ')}.`);
}

const codeowners = read('.github/CODEOWNERS');
for (const sensitivePath of ['/wrangler.jsonc', '/wrangler.source.jsonc', '/next.config.ts', '/public/_headers', '/.github/']) {
  fail(codeowners.includes(sensitivePath), `CODEOWNERS is missing sensitive path ${sensitivePath}.`);
}
fail(!/narrat|public\/audio/iu.test(codeowners), 'CODEOWNERS still references held narration paths.');

const gitignore = read('.gitignore');
for (const pattern of ['.env*', '*.key', '*.p12', '*.pfx', '*.der', '*.sqlite', '*.db', '.npmrc', '.netrc', '/dist/', '/.wrangler/', '/.openai/', '/assets-source/archive/', '/node_modules', '/.venv*/', '__pycache__/', '*.py[cod]']) {
  fail(gitignore.includes(pattern), `.gitignore is missing release exclusion ${pattern}.`);
}

const deploymentGuide = read('docs/CLOUDFLARE_DEPLOYMENT.md');
fail(deploymentGuide.includes('build command `npm run check`'), 'Cloudflare build instructions must run the complete technical check.');
fail(deploymentGuide.includes('production deploy command `npm run deploy:production`'), 'Cloudflare production instructions must use the publication-gated built deploy.');
fail(deploymentGuide.includes('non-production branch deploy command `npm run deploy:preview`'), 'Cloudflare preview instructions must upload the built vinext configuration.');

for (const forbiddenPath of [
  'app/api/narration/route.ts',
  'app/useNarrator.ts',
  'app/narration.mjs',
  'app/narration-provider.mjs',
  'app/narration-limiter.mjs',
  'app/narration-allowlist.json',
  'app/reviewed-narration.mjs',
  'public/audio',
]) {
  fail(!fs.existsSync(path.join(root, forbiddenPath)), `Held narration path remains in the launch source: ${forbiddenPath}.`);
}
for (const relative of ['app/page.tsx', 'app/afterword/vesuvius/VesuviusAfterword.tsx', 'package.json', 'README.md']) {
  fail(!/useNarrator|\/api\/narration|reviewed narration|device narrator|narrator:audition/iu.test(read(relative)), `Launch-facing narration reference remains in ${relative}.`);
}

const robots = read('app/robots.ts');
fail(robots.includes("rules: { userAgent: '*', allow: '/' }"), 'Public robots route must allow crawling when indexing is enabled.');
fail(robots.includes('sitemap: `${policy.origin}/sitemap.xml`'), 'Robots route must advertise the canonical sitemap.');

const skippedDirectories = new Set(['.git', '.next', '.openai', '.vinext', '.wrangler', 'dist', 'node_modules', 'outputs', 'work']);
const skippedPathPrefixes = ['assets-source/archive/'];
const textExtensions = new Set(['', '.cff', '.css', '.html', '.js', '.json', '.jsonc', '.md', '.mjs', '.toml', '.ts', '.tsx', '.txt', '.xml', '.yml', '.yaml']);
// Keep the signatures executable without embedding the forbidden deployment
// strings verbatim in a second verifier. `verify-public-release.mjs` scans this
// source file too, while excluding only its own marker definitions.
const privateMarkers = [
  ['naturalis-historia-codex.hbvfty', 'chatgpt.site'].join('.'),
  ['owner', 'only delivery'].join('-'),
  ['Private', 'edition'].join(' '),
];
const markerDefinitionFiles = new Set(['scripts/verify-public-release.mjs', 'scripts/verify-release-security.mjs']);
const tokenPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u,
  /\bsk-[A-Za-z0-9_-]{24,}\b/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bAIza[0-9A-Za-z_-]{30,}\b/u,
  /\bgh(?:p|o|u|s|r)_[A-Za-z0-9_]{20,}\b/u,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/u,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u,
  /\bAuthorization\s*:\s*(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/iu,
  /\b(?:Set-Cookie|Cookie)\s*:\s*[A-Za-z0-9_-]{2,}=[^;\s]{12,}/iu,
  /(?:[?&]|\b)(?:session[_-]?id|sid|auth[_-]?token)=[A-Za-z0-9._~-]{16,}/iu,
];
const assignmentPattern = /\b(OPENAI_API_KEY|OPENROUTER_API_KEY|ELEVENLABS_API_KEY|CARTESIA_API_KEY|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|GITHUB_TOKEN|NPM_TOKEN|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|GOOGLE_API_KEY|SENTRY_AUTH_TOKEN|DATABASE_URL)\s*=(?!=)\s*(['"]?)([^\s'";]+)\2/gu;
const safePlaceholder = (value) => value === '...' || value.startsWith('<') || value.startsWith('$');
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const allowedPublicEmails = new Set(['git@github.com']);

const stack = [root];
while (stack.length) {
  const directory = stack.pop();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (skippedPathPrefixes.some((prefix) => relative.startsWith(prefix))) continue;
    if (entry.isDirectory()) {
      stack.push(absolute);
      continue;
    }
    if (entry.name.startsWith('.env') && entry.name !== '.env.example') continue;
    if (!textExtensions.has(path.extname(entry.name))) continue;
    const text = fs.readFileSync(absolute, 'utf8');
    for (const pattern of tokenPatterns) fail(!pattern.test(text), `Credential-like token found in ${relative}.`);
    assignmentPattern.lastIndex = 0;
    for (const match of text.matchAll(assignmentPattern)) {
      if (!safePlaceholder(match[3])) failures.push(`Non-placeholder ${match[1]} assignment found in ${relative}.`);
    }
    emailPattern.lastIndex = 0;
    for (const match of text.matchAll(emailPattern)) {
      if (!allowedPublicEmails.has(match[0].toLowerCase())) failures.push(`Unexpected email address found in ${relative}.`);
    }
    fail(!/(?:\/Users\/[^/\s]+\/|[A-Za-z]:\\Users\\[^\\\s]+\\)/u.test(text), `Absolute home-directory path found in ${relative}.`);
    if (!markerDefinitionFiles.has(relative)) {
      for (const marker of privateMarkers) fail(!text.includes(marker), `Private deployment marker found in ${relative}.`);
    }
  }
}

if (failures.length) {
  console.error(`Release security verification failed with ${failures.length} finding${failures.length === 1 ? '' : 's'}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Verified pinned install metadata, gated deploy scripts, Cloudflare config, CSP/header parity, CI controls, packaging exclusions, and zero credential, session, PII, or private-path signatures in public text files.');
