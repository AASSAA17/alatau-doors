import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getMigrations } from 'better-auth/db/migration';
import { auth } from '../src/lib/server/auth';
import { getPool } from '../src/lib/server/db';
import { postgres, maintenance } from '../src/lib/server/environment';
export async function migrateCloud() {
  if (!postgres || !maintenance || process.env.ALATAU_DB_TASK !== 'migrate')
    throw new Error('Explicit PostgreSQL migration environment required.');
  const pool = getPool(),
    client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(71420302)');
    const existing = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public'",
    );
    const allowed = new Set([
      'user',
      'session',
      'account',
      'verification',
      'rateLimit',
      'schema_migrations',
      'products',
      'variants',
      'favorites',
      'drafts',
      'requests',
      'request_items',
      'quotes',
      'request_events',
      'internal_comments',
      'store_settings',
      'audit_log',
      'app_meta',
      'demo_limits',
      'entry_limits',
      'guest_inquiries',
      'twoFactor', 'auth_links', 'mfa_enrollments', 'media', 'demo_payments',
    ]);
    if (existing.rows.some((r) => !allowed.has(r.tablename)))
      throw new Error('Database is not an empty or recognized Alatau database.');
    const migrations = await getMigrations(auth.options);
    await migrations.runMigrations();
    await client.query('BEGIN');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    for (const [version, file] of [[1, '001_business.sql'], [2, '002_entry_methods.sql'], [3, '003_account_security.sql'], [4, '004_media.sql'], [5, '005_demo_payments.sql']] as const) {
    const sql = readFileSync('migrations/postgres/' + file, 'utf8').replace(/\r\n/g, '\n');
    const checksum = createHash('sha256').update(sql).digest('hex');
    // Old Windows checkouts recorded CRLF bytes. Accept only the two line-ending
    // representations of this exact SQL; keep historical checksums unchanged.
    const windowsChecksum = createHash('sha256').update(sql.replace(/\n/g, '\r\n')).digest('hex');
    const applied = await client.query('SELECT checksum FROM schema_migrations WHERE version=$1', [version]);
    if (applied.rows.length) {
      if (![checksum, windowsChecksum].includes(applied.rows[0].checksum)) throw new Error('Migration checksum mismatch.');
    } else {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)', [
        version, checksum,
      ]);
    }
    }
    await client.query('COMMIT');
    console.log('PostgreSQL migrations verified. No seed or reset performed.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.query('SELECT pg_advisory_unlock(71420302)').catch(() => {});
    client.release();
  }
}
migrateCloud()
  .then(() => getPool().end())
  .catch(() => {
    console.error(
      'Cloud migration failed; no credentials logged. Check configuration and migration checksum.',
    );
    process.exitCode = 1;
  });
