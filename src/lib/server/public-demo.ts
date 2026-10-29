import { getDb, getPool } from './db';
import { publicDemo, maintenance } from './environment';
import { fail } from './access';
import type { Actor } from '@/types/workspace';
import type { Mutation } from './schemas';
export function sharedDemoAccount(email: string) {
  return ['admin', 'seller-a', 'seller-b', 'buyer-a', 'buyer-b'].some(
    (key) => email === `${key}@alatau.demo`,
  );
}
export async function demoLimit(key: string, max: number, seconds: number) {
  if (!publicDemo || maintenance) return;
  const result = await getPool().query(
    `INSERT INTO demo_limits(key,count,expires_at) VALUES($1,1,now()+$3*interval '1 second')
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN demo_limits.expires_at<=now() THEN 1 ELSE demo_limits.count+1 END,
    expires_at=CASE WHEN demo_limits.expires_at<=now() THEN now()+$3*interval '1 second' ELSE demo_limits.expires_at END
    WHERE demo_limits.count<$2 OR demo_limits.expires_at<=now() RETURNING count`,
    [key, max, seconds],
  );
  if (!result.rowCount) fail('DEMO_LIMIT', 429);
}
export async function demoWritePolicy(actor: Actor, input: Mutation) {
  if (!publicDemo || maintenance) return;
  if (input.action === 'createUser') fail('DEMO_RESTRICTED', 403);
  const db = getDb();
  if (input.action === 'user') {
    const target = (await db.prepare('SELECT role FROM user WHERE id=?').get(input.id)) as
      { role: string } | undefined;
    if (!target || target.role !== 'BUYER' || input.role !== 'BUYER') fail('DEMO_RESTRICTED', 403);
  }
  const count = async (sql: string, ...values: unknown[]) =>
    Number(((await db.prepare(sql).get(...values)) as { n: string | number }).n);
  if (
    input.action === 'createRequest' &&
    ((await count('SELECT count(*) AS n FROM requests')) >= 200 ||
      (await count('SELECT count(*) AS n FROM requests WHERE buyerId=?', actor.id)) >= 20)
  )
    fail('DEMO_LIMIT', 429);
  if (
    input.action === 'product' &&
    !input.id &&
    (await count('SELECT count(*) AS n FROM products')) >= 60
  )
    fail('DEMO_LIMIT', 429);
  if (
    input.action === 'comment' &&
    (await count('SELECT count(*) AS n FROM internal_comments')) >= 500
  )
    fail('DEMO_LIMIT', 429);
  if (
    input.action === 'quote' &&
    (await count('SELECT count(*) AS n FROM quotes WHERE requestId=?', input.requestId)) >= 10
  )
    fail('DEMO_LIMIT', 429);
}
