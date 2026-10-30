import { createHmac } from 'node:crypto';
import { getDb } from './db';

export const privateKey = (value: string) => createHmac('sha256', process.env.BETTER_AUTH_SECRET!).update(value).digest('hex');
export async function entryLimit(key: string, max: number, seconds: number) {
  const now = Date.now();
  const result = await getDb().prepare(`INSERT INTO entry_limits(key,count,expires) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN entry_limits.expires<=? THEN 1 ELSE entry_limits.count+1 END,
    expires=CASE WHEN entry_limits.expires<=? THEN ? ELSE entry_limits.expires END
    WHERE entry_limits.count<? OR entry_limits.expires<=?`).run(key, now + seconds * 1000, now, now, now + seconds * 1000, max, now);
  if (!result.changes) throw new Error('ENTRY_LIMIT');
}
export async function limitEntry(request: Request, category: string, recipient: string, send: boolean) {
  // Vercel overwrites this header. Outside Vercel use a conservative shared bucket.
  const ip = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for') || 'unknown' : 'local';
  const db = getDb();
  await db.prepare('DELETE FROM entry_limits WHERE expires<=?').run(Date.now());
  // Global gate first also bounds table growth from random recipient/IP attacks.
  await entryLimit(`${category}:global`, send ? 50 : 300, 3600);
  await entryLimit(`${category}:ip:${privateKey(ip)}`, send ? 5 : 30, 600);
  await entryLimit(`${category}:recipient:${privateKey(recipient)}`, send ? 1 : 5, 60);
}
