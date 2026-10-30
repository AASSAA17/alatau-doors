import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes, randomUUID, createCipheriv, createDecipheriv } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { rootCertificates } from 'node:tls';

const root = resolve('.local/backups');
const magic = Buffer.from('ALATAUBK1');
const maxBytes = 256 * 1024 * 1024;
function key(create = false) {
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const path = resolve(process.env.BACKUP_KEY_FILE || join(root, 'backup-key.bin'));
  if (!existsSync(path) && create) writeFileSync(path, randomBytes(32), { flag: 'wx', mode: 0o600 });
  const value = readFileSync(path);
  if (value.length !== 32) throw new Error('Backup key must contain exactly 32 bytes.');
  return value;
}
function seal(data, provider) {
  if (data.length > maxBytes) throw new Error('Backup exceeds this small-catalog tool capacity.');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(true), iv);
  const header = Buffer.concat([magic, Buffer.from([provider === 'postgres' ? 1 : 2]), iv]);
  cipher.setAAD(header);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const path = join(root, `${provider}-${Date.now()}-${randomUUID()}.adbackup`);
  writeFileSync(path, Buffer.concat([header, cipher.getAuthTag(), encrypted]), { flag: 'wx', mode: 0o600 });
  return path;
}
function unseal(path) {
  if (statSync(path).size > maxBytes + 64) throw new Error('Backup exceeds tool capacity.');
  const file = readFileSync(path);
  const headerLength = magic.length + 1 + 12;
  if (file.length > maxBytes + 64 || file.length < headerLength + 17 || !file.subarray(0, magic.length).equals(magic)) throw new Error('Invalid backup format.');
  const kind = file[magic.length];
  if (![1, 2].includes(kind)) throw new Error('Invalid backup provider.');
  const header = file.subarray(0, headerLength);
  const decipher = createDecipheriv('aes-256-gcm', key(), header.subarray(magic.length + 1));
  decipher.setAAD(header);
  decipher.setAuthTag(file.subarray(headerLength, headerLength + 16));
  // Authenticate the entire archive before creating a database or executing SQL.
  const data = Buffer.concat([decipher.update(file.subarray(headerLength + 16)), decipher.final()]);
  return { data, provider: kind === 1 ? 'postgres' : 'sqlite' };
}
function pgEnv(connection) {
  const url = new URL(connection);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL connection required.');
  const local = ['127.0.0.1', 'localhost'].includes(url.hostname);
  if (!local && !url.hostname.endsWith('.neon.tech')) throw new Error('Only configured Neon or loopback backup sources are supported.');
  let caPath;
  if (!local) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    caPath = join(root, 'trusted-roots.pem');
    writeFileSync(caPath, rootCertificates.join('\n'), { mode: 0o600 });
  }
  return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: local ? 'disable' : 'verify-full', PGCONNECT_TIMEOUT: '15',
    // Use Node's bundled CA roots consistently on Windows and Linux, never disable TLS verification.
    ...(local ? {} : { PGSSLROOTCERT: caPath }) };
}
function pgCommand(name, args, connection, input) {
  const bin = process.env.POSTGRES_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '');
  const command = bin ? join(bin, name + (process.platform === 'win32' ? '.exe' : '')) : name;
  const result = spawnSync(command, args, { env: pgEnv(connection), input, windowsHide: true, maxBuffer: maxBytes, timeout: 180000 });
  if (result.status !== 0 || result.error) {
    const stderr = result.stderr?.toString() || '';
    const category = /certificate|SSL/i.test(stderr) ? 'TLS' : /version mismatch/i.test(stderr) ? 'client version' : /permission denied/i.test(stderr) ? 'permissions' : 'connection or database';
    throw new Error(`${name} failed (${category}). Credentials and database output suppressed.`);
  }
  return result.stdout;
}
export async function backupPostgres(connection) {
  const data = pgCommand('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--schema=public', '--no-password'], connection);
  return seal(data, 'postgres');
}
export async function backupSqlite(source) {
  if (!existsSync(source)) throw new Error('Existing SQLite source required.');
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const temp = join(root, `snapshot-${randomUUID()}.sqlite`);
  const database = new Database(source, { readonly: true, fileMustExist: true });
  try {
    await database.backup(temp);
    if (statSync(temp).size > maxBytes) throw new Error('SQLite backup exceeds tool capacity.');
    return seal(readFileSync(temp), 'sqlite');
  } finally { database.close(); if (existsSync(temp)) unlinkSync(temp); }
}
export async function verifyBackup(path, adminConnection) {
  const { data, provider } = unseal(path);
  if (provider === 'sqlite') {
    const restored = join(root, `verified-${randomUUID()}.sqlite`);
    writeFileSync(restored, data, { flag: 'wx', mode: 0o600 });
    const db = new Database(restored, { readonly: true });
    try {
      if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) throw new Error('Restored SQLite failed integrity checks.');
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
      const counts = Object.fromEntries(tables.map(({ name }) => [name, db.prepare('SELECT count(*) AS n FROM "' + name.replaceAll('"', '""') + '"').get().n]));
      return { provider, verified: true, tables: counts };
    } finally { db.close(); unlinkSync(restored); }
  }
  const url = new URL(adminConnection || '');
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || process.env.VERCEL) throw new Error('Restore verification accepts an isolated loopback PostgreSQL server only.');
  const database = `alatau_restore_${Date.now()}_${randomBytes(6).toString('hex')}`;
  const owner = new Pool({ connectionString: url.toString() });
  await owner.query(`CREATE DATABASE "${database}"`);
  url.pathname = '/' + database;
  let restored;
  try {
    pgCommand('pg_restore', ['--no-owner', '--no-acl', '--exit-on-error', '--single-transaction', '--clean', '--if-exists', '--no-password', '--dbname=' + database], url.toString(), data);
    restored = new Pool({ connectionString: url.toString() });
    const tables = await restored.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    const counts = {};
    for (const { tablename } of tables.rows) counts[tablename] = Number((await restored.query('SELECT count(*) AS n FROM "' + tablename.replaceAll('"', '""') + '"')).rows[0].n);
    return { provider, verified: true, tables: counts };
  } finally {
    if (restored) await restored.end();
    // Only the fresh, internally generated verification database is ever removed.
    await owner.query(`DROP DATABASE "${database}"`);
    await owner.end();
  }
}
async function main() {
  if (process.env.VERCEL) throw new Error('Backups run only from a private operator machine.');
  const [command, argument] = process.argv.slice(2);
  if (command === 'postgres') {
    if (!process.env.DATABASE_URL_UNPOOLED) throw new Error('DATABASE_URL_UNPOOLED is required.');
    console.log('Encrypted backup:', await backupPostgres(process.env.DATABASE_URL_UNPOOLED));
  } else if (command === 'sqlite') {
    if (!argument) throw new Error('Pass the exact existing SQLite path.');
    console.log('Encrypted backup:', await backupSqlite(resolve(argument)));
  } else if (command === 'verify') {
    if (!argument) throw new Error('Pass the encrypted archive path.');
    let connection = process.env.PG_TEST_ADMIN_URL;
    if (!connection && existsSync('.local/postgres-test/config.json')) {
      const config = JSON.parse(readFileSync('.local/postgres-test/config.json', 'utf8'));
      connection = `postgresql://alatau_test:${config.password}@127.0.0.1:55432/postgres`;
    }
    console.log(JSON.stringify(await verifyBackup(resolve(argument), connection), null, 2));
  } else throw new Error('Usage: node scripts/backup.mjs postgres | sqlite <existing-path> | verify <archive>');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Backup operation failed; no secrets logged. Check the private configuration, archive/key and database client.'); process.exitCode = 1; });
}
