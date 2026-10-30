import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { Pool } from 'pg';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
const config = process.env.PG_TEST_ADMIN_URL
  ? null
  : JSON.parse(readFileSync('.local/postgres-test/config.json', 'utf8'));
const adminUrl =
  process.env.PG_TEST_ADMIN_URL ||
  `postgresql://alatau_test:${config.password}@127.0.0.1:55432/postgres`;
const url = new URL(adminUrl);
if (!['127.0.0.1', 'localhost'].includes(url.hostname))
  throw new Error('Public demo tests accept loopback PostgreSQL only.');
const suffix = `${Date.now()}_${process.pid}`,
  dbname = 'alatau_public_' + suffix,
  role = 'alatau_app_' + suffix;
const owner = new Pool({ connectionString: adminUrl });
await owner.query(`CREATE DATABASE "${dbname}"`);
const password = randomBytes(32).toString('hex');
// Names and password consist exclusively of generated ASCII alphanumerics/underscores.
await owner.query(
  `CREATE ROLE "${role}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}'`,
);
await owner.end();
url.pathname = '/' + dbname;
const ownerUrl = url.toString();
const env = {
  ...process.env,
  APP_MODE: 'public-demo',
  AUTH_SECURITY: process.argv.includes('--security') ? 'required' : '',
  DATABASE_PROVIDER: 'postgres',
  DATABASE_URL: ownerUrl,
  BETTER_AUTH_URL: 'https://127.0.0.1:3343',
  BETTER_AUTH_SECRET: randomBytes(48).toString('base64url'),
  DEMO_CREDENTIALS_PATH: resolve(`.local/${dbname}-credentials.json`),
  ALATAU_TEST_PROVIDER: 'postgres',
  ALATAU_TEST_RUN: dbname,
  AUTH_MAIL_PROVIDER: 'test',
  AUTH_TEST_MAIL_DIR: resolve(`.local/${dbname}-mail`),
  ALATAU_TEST_OWNER_URL: ownerUrl,
};
env.ALATAU_TEST_CREDENTIALS = env.DEMO_CREDENTIALS_PATH;
function run(args, extra = {}) {
  const r = spawnSync(process.execPath, args, {
    env: { ...env, ...extra },
    stdio: 'inherit',
    windowsHide: true,
  });
  if (r.status !== 0) process.exit(r.status || 1);
}
run(['--import', 'tsx', 'scripts/cloud-migrate.ts'], { ALATAU_DB_TASK: 'migrate' });
const migrationDb = new Pool({ connectionString: ownerUrl });
const initialSql = readFileSync('migrations/postgres/001_business.sql', 'utf8').replace(/\r\n/g, '\n');
const hashSql = (text) => createHash('sha256').update(text).digest('hex');
await migrationDb.query('UPDATE schema_migrations SET checksum=$1 WHERE version=1', [hashSql(initialSql.replace(/\n/g, '\r\n'))]);
run(['--import', 'tsx', 'scripts/cloud-migrate.ts'], { ALATAU_DB_TASK: 'migrate' });
await migrationDb.query('UPDATE schema_migrations SET checksum=$1 WHERE version=1', ['invalid-migration-fixture']);
const tampered = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/cloud-migrate.ts'], {
  env: { ...env, ALATAU_DB_TASK: 'migrate' }, stdio: 'ignore', windowsHide: true,
});
assert.notEqual(tampered.status, 0, 'Content mismatch must still fail migration');
await migrationDb.query('UPDATE schema_migrations SET checksum=$1 WHERE version=1', [hashSql(initialSql)]);
await migrationDb.end();
console.log('Migration checksum checks passed: historical CRLF accepted, changed content rejected.');
run(['--import', 'tsx', 'scripts/seed.ts'], {
  ALATAU_DB_TASK: 'seed',
  DEMO_SEED_CONFIRM: 'fictional-data-only',
});
const admin = new Pool({ connectionString: ownerUrl });
// Synthetic accounts in a newly generated, loopback-only test database.
if (process.argv.includes('--security')) await admin.query('UPDATE "user" SET "emailVerified"=true');
await admin.query(
  readFileSync('scripts/postgres-runtime-grants.sql', 'utf8').replaceAll('alatau_demo_app', role),
);
url.username = role;
url.password = password;
env.DATABASE_URL = url.toString();
env.ALATAU_DB_TASK = '';
env.ALATAU_TEST_OWNER_URL = ownerUrl;
if (!process.argv.includes('--security')) run(['--import', 'tsx', 'scripts/test-entry-methods.ts']);
if (process.argv.includes('--google')) {
  env.GOOGLE_CLIENT_ID = 'local-test.apps.googleusercontent.com';
  env.GOOGLE_CLIENT_SECRET = randomBytes(32).toString('hex');
  env.ALATAU_TEST_OWNER_URL = ownerUrl;
  run(['--import', 'tsx', 'scripts/test-google-auth.ts']);
}
const app = new Pool({ connectionString: env.DATABASE_URL });
for (const sql of [
  "UPDATE app_meta SET value='invalid' WHERE key='publicDemo'",
  'CREATE TABLE forbidden(id int)',
  'DELETE FROM quotes',
  "INSERT INTO mfa_enrollments(\"userId\",\"tokenHash\",\"expiresAt\") VALUES('x','x',0)",
  "UPDATE request_events SET status='NEW'",
]) {
  await assert.rejects(app.query(sql), (error) => error.code === '42501');
}
await app.end();
console.log(
  'Runtime SQL permissions verified: no DDL, metadata modification, quote deletion or history rewriting.',
);
run(['--import', 'tsx', 'scripts/check-database-mode.ts']);
const guardPath = resolve(`.local/${dbname}-production.sqlite`);
const sqliteGuard = new Database(guardPath);
sqliteGuard.exec(
  "CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT);INSERT INTO app_meta VALUES('seedComplete','1');",
);
sqliteGuard.close();
for (const extra of [
  { DATABASE_URL: ownerUrl },
  { APP_MODE: 'production' },
  { APP_MODE: 'demo' },
  { DATABASE_PROVIDER: 'sqlite', VERCEL: '1' },
  { VERCEL: '1', AUTH_SECURITY: 'required', AUTH_MAIL_PROVIDER: 'test' },
  { BETTER_AUTH_URL: 'http://127.0.0.1:3343' },
  { APP_MODE: 'production', DATABASE_PROVIDER: 'sqlite', DATABASE_PATH: guardPath },
]) {
  const check = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-database-mode.ts'], {
    env: { ...env, ...extra },
    stdio: 'ignore',
    windowsHide: true,
  });
  assert.notEqual(check.status, 0, 'Unsafe database mode must be rejected');
}
await admin.query("DELETE FROM app_meta WHERE key='publicDemo'");
const unmarked = spawnSync(
  process.execPath,
  ['--import', 'tsx', 'scripts/check-database-mode.ts'],
  { env, stdio: 'ignore', windowsHide: true },
);
assert.notEqual(unmarked.status, 0, 'An unmarked PostgreSQL database must be rejected');
await admin.query("INSERT INTO app_meta VALUES('publicDemo','cloud-v1')");
await admin.end();
console.log('Production/local/public-demo environment guards verified.');
mkdirSync('.local/postgres-test', { recursive: true });
if (!existsSync('.local/postgres-test/cert.pem')) {
  const openssl =
    process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl';
  const result = spawnSync(
    openssl,
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      '.local/postgres-test/key.pem',
      '-out',
      '.local/postgres-test/cert.pem',
      '-days',
      '7',
      '-subj',
      '/CN=127.0.0.1',
      '-addext',
      'subjectAltName=IP:127.0.0.1',
    ],
    { stdio: 'ignore', windowsHide: true },
  );
  assert.equal(result.status, 0, 'Local HTTPS certificate generation');
}
if (process.argv.includes('--build')) run(['node_modules/next/dist/bin/next', 'build']);
run(['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.public.config.ts',
  ...(process.argv.includes('--security') ? ['account-security.spec.ts'] : [])]);
// Verify the hard account cap under concurrent inserts, independent of HTTP rate limiting.
const capPool = new Pool({ connectionString: env.DATABASE_URL });
const insertUser = () => {
  const id = randomBytes(16).toString('hex');
  return capPool.query(
    'INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt",role,active,phone) VALUES($1,$2,$3,false,now(),now(),$4,true,$5)',
    [id, 'Capacity fixture', `${id}@example.test`, 'BUYER', ''],
  );
};
while (Number((await capPool.query('SELECT count(*) AS n FROM "user"')).rows[0].n) < 49)
  await insertUser();
const capacity = await Promise.allSettled([insertUser(), insertUser()]);
assert.equal(capacity.filter((r) => r.status === 'fulfilled').length, 1);
assert.equal(
  capacity.filter((r) => r.status === 'rejected' && r.reason.code === '23514').length,
  1,
);
assert.equal(Number((await capPool.query('SELECT count(*) AS n FROM "user"')).rows[0].n), 50);
await capPool.end();
console.log('Concurrent registration hard cap verified: exactly 50 accounts.');
console.log(
  'Restricted public demo passed on local HTTPS/PostgreSQL. No remote service contacted.',
);
