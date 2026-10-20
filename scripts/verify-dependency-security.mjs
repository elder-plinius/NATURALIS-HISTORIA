import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(filename), '..');
const require = createRequire(path.join(root, 'package.json'));
let braces;

if (process.argv[2] === '--adversarial-child') {
  braces = require('braces');
  const guarded = (fn) => assert.throws(fn, (error) =>
    (error instanceof SyntaxError || error instanceof RangeError)
    && /exceeds max depth|parent chain contains a cycle/u.test(error.message)
    && !/Maximum call stack/u.test(error.message));
  for (const operation of ['parse', 'compile', 'expand', 'stringify']) {
    for (const [open, close] of [['{', '}'], ['(', ')']]) {
      const input = open.repeat(3000) + 'x' + close.repeat(3000);
      guarded(() => braces[operation](input));
      for (const maxDepth of [Infinity, NaN, 100000, 'unbounded', false]) {
        guarded(() => braces[operation](input, { maxDepth }));
      }
    }
  }
  for (const operation of ['compile', 'expand', 'stringify']) {
    let deep = { type: 'text', value: 'x' };
    for (let i = 0; i < 12000; i += 1) deep = { type: 'root', nodes: [deep] };
    guarded(() => braces[operation](deep));
    const cycle = { type: 'root', nodes: [] };
    cycle.nodes.push(cycle);
    guarded(() => braces[operation](cycle));
  }
  const parentCycle = { type: 'paren', nodes: [{ type: 'text', value: 'x' }] };
  parentCycle.parent = parentCycle;
  guarded(() => braces.expand(parentCycle));
  const a = { type: 'paren', nodes: [{ type: 'text', value: 'x' }] };
  const b = { type: 'paren', parent: a };
  a.parent = b;
  guarded(() => braces.expand(a));
  console.log('Bounded nested-pattern, supplied-AST, option-clamp and parent-cycle regressions passed.');
  process.exit(0);
}

const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const packageJson = readJson('package.json');
assert.equal(packageJson.devDependencies.braces, 'file:vendor/braces');
assert.equal(packageJson.overrides.braces, '$braces');
assert.equal(packageJson.overrides.fflate, '0.8.3');
const receipt = readJson('vendor/braces/SECURITY-BACKPORT.json');
const installedRoot = path.dirname(require.resolve('braces/package.json'));
const installedPackage = JSON.parse(fs.readFileSync(path.join(installedRoot, 'package.json'), 'utf8'));
assert.equal(installedPackage.name, '@naturalis-historia/braces-patched');
assert.equal(installedPackage.version, '3.0.3');
assert.equal(installedPackage.private, true);
for (const [relative, expected] of Object.entries(receipt.installedFileSha256)) {
  for (const directory of [path.join(root, 'vendor/braces'), installedRoot]) {
    const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, relative))).digest('hex');
    assert.equal(digest, expected, `Security backport bytes differ: ${relative}`);
  }
}
const lock = readJson('package-lock.json');
let callers = 0;
for (const [relative, metadata] of Object.entries(lock.packages)) {
  if (!relative.startsWith('node_modules/')) continue;
  if (relative.endsWith('/braces')) {
    assert.equal(fs.realpathSync(path.join(root, relative)), fs.realpathSync(installedRoot), 'An unpatched braces copy remains installed.');
  }
  if (metadata.dependencies?.braces) {
    const callerRequire = createRequire(path.join(root, relative, 'package.json'));
    assert.equal(fs.realpathSync(path.dirname(callerRequire.resolve('braces/package.json'))), fs.realpathSync(installedRoot));
    callers += 1;
  }
  if (relative.endsWith('/fflate')) assert.equal(metadata.version, '0.8.3', 'An old compression library remains locked.');
}
assert.ok(callers > 0, 'No real transitive braces consumer was verified.');
braces = require('braces');
assert.deepEqual(braces.expand('a/{1..3}/{x,y}'), ['a/1/x', 'a/1/y', 'a/2/x', 'a/2/y', 'a/3/x', 'a/3/y']);
assert.deepEqual(braces.expand('foo/({a,b})'), ['foo/(a)', 'foo/(b)']);
for (const operation of ['compile', 'expand', 'stringify']) {
  assert.doesNotThrow(() => braces[operation]('{'.repeat(100) + 'x,y' + '}'.repeat(100)));
  assert.throws(() => braces[operation]('{{a,b},c}', { maxDepth: 1 }), /exceeds max depth/u);
}
const micromatch = require('micromatch');
assert.deepEqual(micromatch(['a.js', 'b.ts', 'c.png'], '**/*.{js,ts}'), ['a.js', 'b.ts']);
const fixture = new TextEncoder().encode('Naturalis Historia: nōmine · 37 books');
const fflate = require('fflate');
assert.deepEqual(fflate.unzlibSync(fflate.zlibSync(fixture)), fixture);
assert.deepEqual(fflate.gunzipSync(fflate.gzipSync(fixture)), fixture);
assert.deepEqual(fflate.unzipSync(fflate.zipSync({ 'text.txt': fixture }))['text.txt'], fixture);
const child = spawnSync(process.execPath, ['--stack-size=512', filename, '--adversarial-child'], {
  cwd: root, encoding: 'utf8', timeout: 5000, maxBuffer: 64 * 1024,
});
assert.equal(child.status, 0, child.error?.message || child.stderr || child.stdout);
console.log(`Verified exact private-backport bytes, ${callers} transitive caller, normal globs, compression/ZIP compatibility, and bounded security regressions. Registry audit is a separate required gate.`);
