import { lookup } from 'node:dns/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'edition-policy.json'), 'utf8'));
const origin = new URL(policy.origin);

if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port || origin.pathname !== '/' || origin.search || origin.hash) {
  throw new Error('Canonical production origin must be a bare HTTPS origin.');
}
if (origin.hostname === 'localhost' || origin.hostname.endsWith('.localhost') || origin.hostname.endsWith('.chatgpt.site')) {
  throw new Error(`Canonical production hostname is not public-release eligible: ${origin.hostname}`);
}

let records;
try {
  records = await lookup(origin.hostname, { all: true, verbatim: true });
} catch (cause) {
  const detail = cause instanceof Error ? cause.message : String(cause);
  throw new Error(`Canonical production hostname does not resolve: ${origin.hostname} (${detail})`);
}
if (!records.length) throw new Error(`Canonical production hostname has no address records: ${origin.hostname}`);

console.log(`Verified canonical HTTPS origin and DNS resolution for ${origin.hostname} (${records.length} address record${records.length === 1 ? '' : 's'}).`);
