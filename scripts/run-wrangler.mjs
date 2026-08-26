import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

if (!args.length) {
  console.error('Usage: node scripts/run-wrangler.mjs <wrangler arguments>');
  process.exit(2);
}

const executable = path.join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler',
);

const result = spawnSync(executable, args, {
  cwd: root,
  env: {
    ...process.env,
    WRANGLER_SEND_METRICS: process.env.WRANGLER_SEND_METRICS ?? 'false',
    WRANGLER_WRITE_LOGS: process.env.WRANGLER_WRITE_LOGS ?? 'false',
    WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH ?? path.join(root, '.wrangler', 'logs'),
  },
  shell: false,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Unable to start Wrangler: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
