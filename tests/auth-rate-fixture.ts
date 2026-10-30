import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { resolve, sep } from 'node:path';
// Each independent scenario starts its own throttle window. Real throttling is
// tested separately in the HTTPS security suite; no application bypass exists.
export async function clearTestAuthRates() {
  if (!process.env.ALATAU_TEST_RUN || process.env.VERCEL) throw new Error('Isolated tests only');
  if (process.env.ALATAU_TEST_PROVIDER === 'postgres') {
    const url = new URL(process.env.DATABASE_URL!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.startsWith('/alatau_test_')) throw new Error('Isolated PostgreSQL fixture required');
    const pool = new Pool({ connectionString: url.toString() });
    try { await pool.query('DELETE FROM "rateLimit"'); } finally { await pool.end(); }
  } else {
    const path = resolve(process.env.ALATAU_TEST_DB!);
    if (!path.startsWith(resolve('.local') + sep + 'e2e-') || !path.endsWith('-demo.sqlite')) throw new Error('Isolated SQLite fixture required');
    const db = new Database(path, { fileMustExist: true });
    try { db.prepare('DELETE FROM rateLimit').run(); } finally { db.close(); }
  }
}
