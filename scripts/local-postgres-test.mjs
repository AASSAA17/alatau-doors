import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
// Disposable, loopback-only cluster. Never uses the installed PostgreSQL service.
const root = resolve('.local/postgres-test');
const bin = process.env.POSTGRES_TEST_BIN || 'C:/Program Files/PostgreSQL/18/bin';
const suffix = process.platform === 'win32' ? '.exe' : '';
mkdirSync(root, { recursive: true });
const configPath = join(root, 'config.json'),
  data = join(root, 'data');
if (!existsSync(configPath))
  writeFileSync(
    configPath,
    JSON.stringify({
      password: randomBytes(32).toString('base64url'),
      secret: randomBytes(48).toString('base64url'),
      invite: randomBytes(32).toString('base64url'),
    }),
    { mode: 0o600 },
  );
const config = JSON.parse(readFileSync(configPath, 'utf8'));
function run(name, args) {
  const result = spawnSync(join(bin, name + suffix), args, { stdio: 'ignore', windowsHide: true });
  if (result.status !== 0) throw new Error(name + ' failed; inspect local test logs.');
}
if (!existsSync(join(data, 'PG_VERSION'))) {
  writeFileSync(join(root, 'password.txt'), config.password, { mode: 0o600 });
  run('initdb', [
    '-D',
    data,
    '-U',
    'alatau_test',
    '--pwfile=' + join(root, 'password.txt'),
    '--auth=scram-sha-256',
    '--encoding=UTF8',
    '--locale=C',
  ]);
}
const status = spawnSync(join(bin, 'pg_ctl' + suffix), ['status', '-D', data], {
  windowsHide: true,
  stdio: 'ignore',
});
if (status.status !== 0)
  run('pg_ctl', [
    'start',
    '-D',
    data,
    '-l',
    join(root, 'server.log'),
    '-o',
    '-h 127.0.0.1 -p 55432',
    '-w',
  ]);
const pool = new Pool({
  host: '127.0.0.1',
  port: 55432,
  user: 'alatau_test',
  password: config.password,
  database: 'postgres',
});
await pool.query('SELECT version()');
await pool.end();
console.log(
  'Isolated PostgreSQL test cluster ready on loopback:55432. Existing service and databases unchanged.',
);
