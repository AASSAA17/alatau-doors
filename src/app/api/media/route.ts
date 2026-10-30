import { AppError, requireActor } from '@/lib/server/access';
import { trustedOrigins } from '@/lib/server/auth';
import { entryLimit } from '@/lib/server/entry-limits';
import { boundedBytes, BodyTooLarge } from '@/lib/server/request-body';
import { storeImage } from '@/lib/server/media';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status: number) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function POST(request: Request) {
  try {
    if (!trustedOrigins.includes(request.headers.get('origin') || '')) return json({ code: 'FORBIDDEN' }, 403);
    const actor = await requireActor(request.headers, ['ADMIN']);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(request.headers.get('content-type') || '')) return json({ code: 'INVALID_IMAGE' }, 415);
    await entryLimit('media:global', 40, 3600);
    await entryLimit('media:' + actor.id, 10, 60);
    return json(await storeImage(await boundedBytes(request, 4 * 1024 * 1024), actor.id), 201);
  } catch (error) {
    if (error instanceof AppError) return json({ code: error.code }, error.status);
    if (error instanceof BodyTooLarge) return json({ code: 'IMAGE_TOO_LARGE' }, 413);
    if (error instanceof Error && error.message === 'ENTRY_LIMIT') return json({ code: 'RATE_LIMIT' }, 429);
    return json({ code: 'SERVER_ERROR' }, 500);
  }
}
