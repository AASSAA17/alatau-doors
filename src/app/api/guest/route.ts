import { trustedOrigins } from '@/lib/server/auth';
import { AppError, requireActor } from '@/lib/server/access';
import { boundedText, BodyTooLarge } from '@/lib/server/request-body';
import { limitEntry } from '@/lib/server/entry-limits';
import { createGuest, guestSchema, listGuests, updateGuest, updateGuestSchema } from '@/lib/server/guest-inquiries';
import { demoLimit } from '@/lib/server/public-demo';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function json(value: unknown, status = 200) { return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } }); }
function error(e: unknown) {
  if (e instanceof AppError) return json({ code: e.code }, e.status);
  if (e instanceof BodyTooLarge) return json({ code: 'INVALID_INPUT' }, 413);
  if (e instanceof Error && e.message === 'ENTRY_LIMIT') return json({ code: 'RATE_LIMIT' }, 429);
  return json({ code: 'SERVER_ERROR' }, 500);
}
export async function GET(request: Request) {
  try { return json(await listGuests(await requireActor(request.headers, ['ADMIN', 'SELLER']))); }
  catch (e) { return error(e); }
}
export async function POST(request: Request) {
  try {
    if (!trustedOrigins.includes(request.headers.get('origin') || '')) return json({ code: 'FORBIDDEN' }, 403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ code: 'INVALID_INPUT' }, 415);
    const raw = await boundedText(request, 12000);
    let data: unknown;
    try { data = JSON.parse(raw); } catch { return json({ code: 'INVALID_INPUT' }, 400); }
    const parsed = guestSchema.safeParse(data);
    if (!parsed.success) return json({ code: 'INVALID_INPUT' }, 400);
    await limitEntry(request, 'guest', parsed.data.contact.toLowerCase(), true);
    return json(await createGuest(parsed.data), 201);
  } catch (e) { return error(e); }
}
export async function PATCH(request: Request) {
  try {
    if (!trustedOrigins.includes(request.headers.get('origin') || '')) return json({ code: 'FORBIDDEN' }, 403);
    const actor = await requireActor(request.headers, ['ADMIN', 'SELLER']);
    await demoLimit('write:' + actor.id, 40, 60);
    let data: unknown;
    try { data = JSON.parse(await boundedText(request, 2000)); } catch { return json({ code: 'INVALID_INPUT' }, 400); }
    const parsed = updateGuestSchema.safeParse(data);
    if (!parsed.success) return json({ code: 'INVALID_INPUT' }, 400);
    return json(await updateGuest(actor, parsed.data));
  } catch (e) { return error(e); }
}
