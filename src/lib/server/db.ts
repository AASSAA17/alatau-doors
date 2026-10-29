import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, types, type PoolClient } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { getSqlite, migrateSqliteBusiness } from './sqlite';
import { postgres, publicDemo, maintenance, validateEnvironment } from './environment';
import { postgresSql } from './sql-dialect';
export { databasePath } from './sqlite';
const globalDb = globalThis as unknown as { alatauPg?: Pool };
const transactionContext = new AsyncLocalStorage<PoolClient | 'sqlite'>();
let sqliteTail: Promise<unknown> = Promise.resolve();
let modeCheck: Promise<void> | undefined;
export function getPool() {
  validateEnvironment();
  if (!globalDb.alatauPg) {
    const url = new URL(process.env.DATABASE_URL!);
    const local = ['127.0.0.1', 'localhost'].includes(url.hostname) && !process.env.VERCEL;
    // Explicit TLS avoids pg sslmode=require compatibility weakening verification.
    url.searchParams.delete('sslmode');
    url.searchParams.delete('channel_binding');
    globalDb.alatauPg = new Pool({
      connectionString: url.toString(),
      ssl: local ? false : { rejectUnauthorized: true },
      max: 5,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true,
      types: {
        getTypeParser: (oid, format) =>
          oid === 20
            ? (value: string) => {
                const number = Number(value);
                if (!Number.isSafeInteger(number)) throw new Error('Unsafe database integer.');
                return number;
              }
            : types.getTypeParser(oid, format),
      },
    });
    globalDb.alatauPg.on('error', () => console.error('PostgreSQL idle connection error'));
    if (process.env.VERCEL) attachDatabasePool(globalDb.alatauPg);
  }
  return globalDb.alatauPg;
}
export async function ensureDatabaseMode() {
  if (!postgres) {
    getSqlite();
    return;
  }
  if (maintenance) return;
  if (!modeCheck)
    modeCheck = (async () => {
      const result = await getPool().query(
        "SELECT key,value FROM app_meta WHERE key IN ('publicDemo','seedComplete')",
      );
      const markers = Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
      if (publicDemo && markers.publicDemo !== 'cloud-v1')
        throw new Error('Not a public demo database.');
      if (publicDemo) {
        const permissions = await getPool().query(`SELECT
          has_table_privilege(current_user,'public.app_meta','UPDATE') OR
          has_table_privilege(current_user,'public.quotes','DELETE') OR
          has_schema_privilege(current_user,'public','CREATE') OR
          rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls AS unsafe
          FROM pg_roles WHERE rolname=current_user`);
        if (permissions.rows[0]?.unsafe !== false)
          throw new Error('Public demo requires a restricted database role.');
      }
      if (process.env.APP_MODE === 'production' && (markers.publicDemo || markers.seedComplete))
        throw new Error('Seeded databases cannot run in production.');
      if (process.env.APP_MODE === 'demo' && markers.publicDemo)
        throw new Error('Public demo requires its restricted mode.');
    })().catch((e) => {
      modeCheck = undefined;
      throw e;
    });
  await modeCheck;
}
export function authDatabase() {
  return postgres ? getPool() : getSqlite();
}
export function authTimestamp() {
  return postgres ? new Date() : Date.now();
}
async function query(sql: string, values: unknown[], kind: 'all' | 'get' | 'run') {
  await ensureDatabaseMode();
  if (postgres) {
    const current = transactionContext.getStore();
    const client = current && current !== 'sqlite' ? current : getPool();
    const result = await client.query(postgresSql(sql), values);
    return kind === 'all'
      ? result.rows
      : kind === 'get'
        ? result.rows[0]
        : { changes: result.rowCount };
  }
  const statement = getSqlite().prepare(sql);
  const bound = values.map((v) => (typeof v === 'boolean' ? +v : v));
  return statement[kind](...bound);
}
export function getDb() {
  return {
    prepare(sql: string) {
      return {
        all: (...values: unknown[]) => query(sql, values, 'all'),
        get: (...values: unknown[]) => query(sql, values, 'get'),
        run: (...values: unknown[]) => query(sql, values, 'run'),
      };
    },
    transaction<T>(fn: () => Promise<T>) {
      return async () => {
        if (transactionContext.getStore()) return fn();
        await ensureDatabaseMode();
        if (postgres) {
          const client = await getPool().connect();
          try {
            await client.query('BEGIN');
            // Demo workload: serialize domain writes across all Vercel instances.
            await client.query('SELECT pg_advisory_xact_lock(71420301)');
            const result = await transactionContext.run(client, fn);
            await client.query('COMMIT');
            return result;
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          } finally {
            client.release();
          }
        }
        const operation = sqliteTail.then(async () => {
          const db = getSqlite();
          db.exec('BEGIN IMMEDIATE');
          try {
            const result = await transactionContext.run('sqlite', fn);
            db.exec('COMMIT');
            return result;
          } catch (error) {
            db.exec('ROLLBACK');
            throw error;
          }
        });
        sqliteTail = operation.catch(() => {});
        return operation;
      };
    },
  };
}
export async function migrateBusiness() {
  if (postgres) throw new Error('Use cloud:migrate for PostgreSQL.');
  migrateSqliteBusiness();
}
