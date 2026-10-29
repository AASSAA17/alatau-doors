import { AppError, getActor, requireActor } from '@/lib/server/access';
import { trustedOrigins } from '@/lib/server/auth';
import { mutationSchema } from '@/lib/server/schemas';
import { favoriteIds, mutate, readWorkspace } from '@/lib/server/workspace';
import { demoLimit } from '@/lib/server/public-demo';
import { boundedText, BodyTooLarge } from '@/lib/server/request-body';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function errorResponse(error: unknown) {
  if (error instanceof BodyTooLarge)
    return Response.json({ code: 'INVALID_INPUT' }, { status: 413 });
  if (error instanceof AppError)
    return Response.json({ code: error.code }, { status: error.status });
  if (error instanceof Error && error.message.includes('UNIQUE constraint'))
    return Response.json({ code: 'DUPLICATE' }, { status: 409 });
  // Never serialize SQL, credentials, auth records, or stack traces to the client.
  if (error && typeof error === 'object' && 'code' in error && error.code === '23505')
    return Response.json({ code: 'DUPLICATE' }, { status: 409 });
  return Response.json({ code: 'SERVER_ERROR' }, { status: 500 });
}
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const resource = url.searchParams.get('resource') || 'me';
    if (resource === 'me') {
      const actor = await getActor(request.headers);
      return Response.json(
        { actor, ids: actor?.role === 'BUYER' ? await favoriteIds(actor.id) : [] },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }
    const actor = await requireActor(request.headers);
    await demoLimit('read:' + actor.id, 180, 60);
    return Response.json(
      await readWorkspace(actor, resource, url.searchParams.get('id') || undefined),
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    if (!trustedOrigins.includes(request.headers.get('origin') || ''))
      return Response.json({ code: 'FORBIDDEN' }, { status: 403 });
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      return Response.json({ code: 'INVALID_INPUT' }, { status: 415 });
    const actor = await requireActor(request.headers);
    await demoLimit('write:' + actor.id, 40, 60);
    await demoLimit('writes-global', 300, 3600);
    const text = await boundedText(request, 100000);
    if (text.length > 100000) return Response.json({ code: 'INVALID_INPUT' }, { status: 413 });
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return Response.json({ code: 'INVALID_INPUT' }, { status: 400 });
    }
    const parsed = mutationSchema.safeParse(raw);
    if (!parsed.success) return Response.json({ code: 'INVALID_INPUT' }, { status: 400 });
    return Response.json(await mutate(actor, parsed.data), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
