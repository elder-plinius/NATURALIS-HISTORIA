import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative));
const receipt = JSON.parse(read('assets-source/favicon-provenance.json'));
const png = read('public/favicon.png');
assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert.equal(png.readUInt32BE(16), 400);
assert.equal(png.readUInt32BE(20), 400);
assert.equal(crypto.createHash('sha256').update(png).digest('hex'), receipt.outputSha256);
assert.equal(crypto.createHash('sha256').update(read(receipt.sourceArtifact)).digest('hex'), receipt.sourceSha256);
assert.deepEqual(await sharp(read(receipt.sourceArtifact)).raw().toBuffer(), await sharp(png).raw().toBuffer(), 'Avatar pixels were altered.');
assert.equal(receipt.sourceUrl, 'https://avatars.githubusercontent.com/u/133052465?v=4');
for (const relative of ['app/layout.tsx', 'app/manifest.ts']) {
  assert.match(read(relative).toString(), /\/favicon\.png/u);
  assert.match(read(relative).toString(), /400x400/u);
}
assert.match(read('scripts/build-share-pages.mjs').toString(), /rel="icon" href="\/favicon\.png" type="image\/png"/u);
assert.match(read('app/layout.tsx').toString(), /apple:.*\/favicon\.png/u);
console.log('Verified source-bound 400px PNG avatar favicon, main/share metadata, web manifest and touch-icon declaration.');
