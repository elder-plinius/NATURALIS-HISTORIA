import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [
  ['release security and deployment boundary', 'verify-release-security.mjs'],
  ['public rights and source policy', 'verify-public-release.mjs'],
  ['independent artwork coverage', 'audit-artwork-coverage.mjs'],
  ['canonical-domain DNS', 'verify-production-domain.mjs'],
];

const failures = [];
for (const [label, script] of checks) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], {
    cwd: root,
    shell: false,
    stdio: 'inherit',
  });
  if (result.status !== 0) failures.push(label);
}

if (failures.length) {
  console.error(`\nRELEASE HOLD: ${failures.length} gate${failures.length === 1 ? '' : 's'} failed: ${failures.join('; ')}`);
  process.exit(1);
}

console.log(`\nRELEASE READY: all ${checks.length} publication gates passed.`);
