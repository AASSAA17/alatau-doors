import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getDb } from './db';
import { fail, requireRole } from './access';
import type { Actor } from '@/types/workspace';

export const guestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  contact: z.union([z.email().max(254), z.string().regex(/^\+7[67]\d{9}$/)]),
  note: z.string().trim().min(5).max(2000), locale: z.enum(['ru', 'kk']),
  consent: z.literal(true), website: z.literal(''),
}).strict();
export type GuestInquiry = { id: string; name: string; contact: string; note: string; locale: string; status: string; sellerId: string | null; createdAt: string; updatedAt: string; revision: number };
export async function createGuest(input: z.infer<typeof guestSchema>) {
  const db = getDb();
  return db.transaction(async () => {
    const count = await db.prepare('SELECT count(*) AS n FROM guest_inquiries').get() as { n: number };
    if (count.n >= 200) fail('DEMO_LIMIT', 429);
    const id = randomUUID(), now = new Date().toISOString();
    await db.prepare("INSERT INTO guest_inquiries(id,name,contact,note,locale,status,createdAt,updatedAt) VALUES(?,?,?,?,?,'NEW',?,?)")
      .run(id, input.name, input.contact, input.note, input.locale, now, now);
    return { id };
  })();
}
export async function listGuests(actor: Actor) {
  requireRole(actor, ['ADMIN', 'SELLER']);
  return (actor.role === 'ADMIN'
    ? await getDb().prepare('SELECT * FROM guest_inquiries ORDER BY createdAt DESC LIMIT 200').all()
    : await getDb().prepare('SELECT * FROM guest_inquiries WHERE sellerId=? ORDER BY createdAt DESC LIMIT 200').all(actor.id)) as GuestInquiry[];
}
export const updateGuestSchema = z.object({ id: z.uuid(), revision: z.number().int().positive(),
  status: z.enum(['NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']), sellerId: z.string().min(1).max(100).nullable(),
}).strict();
export async function updateGuest(actor: Actor, input: z.infer<typeof updateGuestSchema>) {
  requireRole(actor, ['ADMIN', 'SELLER']);
  const db = getDb();
  return db.transaction(async () => {
    const row = await db.prepare('SELECT * FROM guest_inquiries WHERE id=?').get(input.id) as GuestInquiry | undefined;
    if (!row || (actor.role === 'SELLER' && row.sellerId !== actor.id)) fail('NOT_FOUND', 404);
    if (actor.role === 'SELLER' && input.sellerId !== row.sellerId) fail('FORBIDDEN', 403);
    if (input.sellerId) {
      const seller = await db.prepare("SELECT id FROM user WHERE id=? AND role='SELLER' AND active=1").get(input.sellerId);
      if (!seller) fail('INVALID_INPUT');
    }
    if (input.status === 'IN_PROGRESS' && !input.sellerId) fail('INVALID_INPUT');
    const now = new Date().toISOString();
    const changed = await db.prepare('UPDATE guest_inquiries SET status=?,sellerId=?,updatedAt=?,revision=revision+1 WHERE id=? AND revision=?')
      .run(input.status, input.sellerId, now, input.id, input.revision);
    if (!changed.changes) fail('CONFLICT', 409);
    await db.prepare('INSERT INTO audit_log(id,actorId,action,targetId,createdAt) VALUES(?,?,?,?,?)')
      .run(randomUUID(), actor.id, 'guest:' + input.status + ':' + (input.sellerId || 'unassigned'), input.id, now);
    return { ok: true };
  })();
}
