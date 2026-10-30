import { auth, trustedOrigins } from '@/lib/server/auth';
import { getDb, ensureDatabaseMode } from '@/lib/server/db';
import { tokenDigest } from '@/lib/server/auth-mail';
import { boundedText } from '@/lib/server/request-body';
import { demoLimit } from '@/lib/server/public-demo';
import { z } from 'zod';
import { AppError } from '@/lib/server/access';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    await ensureDatabaseMode();
    if (!trustedOrigins.includes(request.headers.get('origin') || '')) return Response.json({code:'FORBIDDEN'}, {status:403});
    await demoLimit('verify-links-global', 100, 60);
    const { token } = z.object({ token: z.string().min(20).max(4096) }).strict().parse(JSON.parse(await boundedText(request, 8192)));
    const consumed = await getDb().prepare('DELETE FROM auth_links WHERE id=? AND expiresAt>? RETURNING userId').get(tokenDigest(token), Date.now());
    if (!consumed) return Response.json({code:'INVALID_TOKEN'}, {status:400});
    // No callback URL or automatic login: verification cannot bypass the MFA challenge.
    await auth.api.verifyEmail({ query: { token }, headers: request.headers });
    return Response.json({status:true}, {headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    if (error instanceof AppError && error.status === 429)
      return Response.json({code:'RATE_LIMIT'}, {status:429});
    return Response.json({code:'INVALID_TOKEN'}, {status:400});
  }
}
