import { getDb } from '@/lib/server/db';
import { mediaIdPattern } from '@/lib/server/media';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!mediaIdPattern.test(id)) return new Response(null, { status: 404 });
  const row = await getDb().prepare('SELECT data FROM media WHERE id=?').get(id) as { data: Buffer } | undefined;
  if (!row) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(row.data), { headers: {
    'Content-Type': 'image/webp', 'Content-Length': String(row.data.length),
    'Cache-Control': 'public, max-age=86400, immutable', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  } });
}
