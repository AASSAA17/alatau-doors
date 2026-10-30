import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { fail } from './access';

export const mediaIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export async function storeImage(bytes: Buffer, actorId: string) {
  let result;
  try {
    const decoder = sharp(bytes, { limitInputPixels: 20_000_000, failOn: 'warning' });
    const meta = await decoder.metadata();
    if (!['jpeg', 'png', 'webp'].includes(meta.format || '') || (meta.pages || 1) !== 1) fail('INVALID_IMAGE', 415);
    result = await decoder.rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    if (result.data.length > 1048576) fail('IMAGE_TOO_LARGE', 413);
  } catch { fail('INVALID_IMAGE', 415); }
  const { data, info } = result;
  const db = getDb();
  return db.transaction(async () => {
    const usage = await db.prepare('SELECT count(*) AS n, COALESCE(sum(size),0) AS bytes FROM media').get() as { n: number; bytes: number };
    // All modes have a hard ceiling; raising it needs an explicit capacity review.
    if (usage.n >= 500 || usage.bytes + data.length > 100 * 1024 * 1024) fail('MEDIA_FULL', 409);
    const id = randomUUID();
    await db.prepare('INSERT INTO media(id,data,width,height,size,createdBy,createdAt) VALUES(?,?,?,?,?,?,?)')
      .run(id, data, info.width, info.height, data.length, actorId, new Date().toISOString());
    await db.prepare('INSERT INTO audit_log(id,actorId,action,targetId,createdAt) VALUES(?,?,?,?,?)')
      .run(randomUUID(), actorId, 'media', id, new Date().toISOString());
    return { url: `/api/media/${id}`, width: info.width, height: info.height };
  })();
}
