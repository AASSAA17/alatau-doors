import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
// Only connects to loopback test PostgreSQL. Never reads the application's DATABASE_URL.
const config = process.env.PG_TEST_ADMIN_URL
  ? null
  : JSON.parse(readFileSync('.local/postgres-test/config.json', 'utf8'));
const adminUrl =
  process.env.PG_TEST_ADMIN_URL ||
  `postgresql://alatau_test:${config.password}@127.0.0.1:55432/postgres`;
const url = new URL(adminUrl);
if (!['localhost', '127.0.0.1'].includes(url.hostname))
  throw new Error('Test runner accepts loopback PostgreSQL only.');
const pool = new Pool({ connectionString: adminUrl });
const dbname = `alatau_test_${Date.now()}_${process.pid}`;
await pool.query(`CREATE DATABASE "${dbname}"`);
await pool.end();
url.pathname = '/' + dbname;
mkdirSync('.local', { recursive: true });
const env = {
  ...process.env,
  APP_MODE: 'demo',
  DATABASE_PROVIDER: 'postgres',
  DATABASE_URL: url.toString(),
  BETTER_AUTH_URL: 'http://127.0.0.1:3100',
  BETTER_AUTH_SECRET: config?.secret || randomBytes(48).toString('base64url'),
  ALATAU_TEST_PROVIDER: 'postgres',
  ALATAU_TEST_RUN: dbname,
  ALATAU_TEST_CREDENTIALS: resolve(`.local/${dbname}-credentials.json`),
};
env.DEMO_CREDENTIALS_PATH = env.ALATAU_TEST_CREDENTIALS;
function run(args, extra = {}) {
  const r = spawnSync(process.execPath, args, {
    env: { ...env, ...extra },
    stdio: 'inherit',
    windowsHide: true,
  });
  if (r.status !== 0) process.exit(r.status || 1);
}
run(['--import', 'tsx', 'scripts/cloud-migrate.ts'], { ALATAU_DB_TASK: 'migrate' });
// A repeat migration must be a no-op.
run(['--import', 'tsx', 'scripts/cloud-migrate.ts'], { ALATAU_DB_TASK: 'migrate' });
run(['--import', 'tsx', 'scripts/seed.ts'], {
  ALATAU_DB_TASK: 'seed',
  DEMO_SEED_CONFIRM: 'fictional-data-only',
});
run(['--import', 'tsx', 'scripts/seed.ts'], {
  ALATAU_DB_TASK: 'seed',
  DEMO_SEED_CONFIRM: 'fictional-data-only',
});
run(['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], {
  ALATAU_DB_TASK: '',
});
console.log(
  'PostgreSQL regression passed. Isolated test database retained locally for inspection.',
);
