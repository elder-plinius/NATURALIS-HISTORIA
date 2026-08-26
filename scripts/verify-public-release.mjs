import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'README.md',
  'LICENSE',
  'NOTICE.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CODE_OF_CONDUCT.md',
  'CITATION.cff',
  'wrangler.jsonc',
  '.github/CODEOWNERS',
  '.github/workflows/ci.yml',
];

for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`Missing public release file: ${relative}`);
}

const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
if (!license.includes('GNU AFFERO GENERAL PUBLIC LICENSE') || !license.includes('Version 3, 19 November 2007')) {
  throw new Error('Root license is not the complete GNU AGPL v3 text');
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (packageJson.name !== 'naturalis-historia' || packageJson.version !== '1.0.0') {
  throw new Error('Public package identity is not pinned to naturalis-historia 1.0.0');
}
if (packageJson.devDependencies?.['@openai/sites-vite-plugin']) {
  throw new Error('Private Sites plugin remains in the public package');
}

const wrangler = fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8');
if (!wrangler.includes('"name": "naturalis-historia"')) throw new Error('Cloudflare Worker name is not canonical');

const policy = JSON.parse(fs.readFileSync(path.join(root, 'edition-policy.json'), 'utf8'));
if (!policy.publicIndexing || policy.accessMode !== 'public') throw new Error('Edition policy is not public');
if (!String(policy.origin).startsWith('https://')) throw new Error('Edition origin is not HTTPS');

const provenance = JSON.parse(fs.readFileSync(path.join(root, 'public/provenance.json'), 'utf8'));
const media = [...(provenance.artifacts ?? []), ...(provenance.assets ?? [])];
const unclearedMedia = media.filter((record) => !record.rightsStatus || String(record.rightsStatus).includes('pending'));
if (unclearedMedia.length) {
  throw new Error(`${unclearedMedia.length} media records remain uncleared; first: ${unclearedMedia.slice(0, 5).map((record) => record.logicalId).join(', ')}`);
}
for (const record of media) {
  if (!record.rightsHolder || !record.license || !record.rightsEvidence) {
    throw new Error(`Cleared media lacks holder, license, or evidence: ${record.logicalId}`);
  }
  if (!record.sourceSha256 || record.rightsSourceSha256 !== record.sourceSha256) {
    throw new Error(`Cleared media rights are not bound to the deployed source hash: ${record.logicalId}`);
  }
}

const forbidden = ['naturalis-historia-codex.hbvfty.chatgpt.site', 'owner-only delivery', 'Private edition'];
const ignored = new Set(['.git', 'node_modules', 'dist', '.next', '.vinext', '.wrangler', 'assets-source']);
const textExtensions = new Set(['.css', '.cff', '.html', '.js', '.json', '.jsonc', '.md', '.mjs', '.ts', '.tsx', '.txt', '.xml', '.yml', '.yaml']);
const stack = [root];
const self = fileURLToPath(import.meta.url);
while (stack.length) {
  const directory = stack.pop();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignored.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      stack.push(absolute);
      continue;
    }
    if (absolute === self) continue;
    if (!textExtensions.has(path.extname(entry.name))) continue;
    const text = fs.readFileSync(absolute, 'utf8');
    for (const phrase of forbidden) {
      if (text.includes(phrase)) throw new Error(`Private release marker '${phrase}' remains in ${path.relative(root, absolute)}`);
    }
  }
}

console.log('Verified AGPL public source, canonical Cloudflare Worker identity, public policy, cleared media records, and zero private Sites markers');
