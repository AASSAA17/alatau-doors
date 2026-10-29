import { auth } from '@/lib/server/auth';
import { registerSchema } from '@/lib/server/schemas';
import { ensureDatabaseMode, getPool } from '@/lib/server/db';
import { publicDemo } from '@/lib/server/environment';
import { demoLimit, sharedDemoAccount } from '@/lib/server/public-demo';
import { boundedText, BodyTooLarge } from '@/lib/server/request-body';
export const runtime = 'nodejs';
const allowed = new Set([
  'sign-in/email',
  'sign-up/email',
  'sign-out',
  'get-session',
  'change-password',
]);
async function handler(request: Request) {
  await ensureDatabaseMode();
  const endpoint = new URL(request.url).pathname.split('/api/auth/')[1];
  if (!allowed.has(endpoint)) return Response.json({ code: 'NOT_FOUND' }, { status: 404 });
  if (publicDemo) {
    try {
      await demoLimit('auth-global', 400, 60);
    } catch {
      return Response.json({ code: 'DEMO_LIMIT' }, { status: 429 });
    }
    if (endpoint === 'change-password') {
      const session = await auth.api.getSession({ headers: request.headers });
      if (session && sharedDemoAccount(session.user.email))
        return Response.json(
          {
            code: 'DEMO_RESTRICTED',
            message: 'The organizer manages shared demonstration credentials.',
          },
          { status: 403 },
        );
    }
  }
  if (request.method === 'POST') {
    try {
      const body = await boundedText(request, 16384);
      request = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body,
      });
    } catch (error) {
      return Response.json(
        { code: 'INVALID_INPUT' },
        { status: error instanceof BodyTooLarge ? 413 : 400 },
      );
    }
  }
  if (endpoint === 'sign-up/email' && request.method === 'POST') {
    if (publicDemo && request.headers.get('origin') !== process.env.BETTER_AUTH_URL)
      return Response.json({ code: 'FORBIDDEN', message: 'Invalid origin.' }, { status: 403 });
    // Validate before spending the shared demo quota; role/active are never accepted.
    try {
      const parsed = registerSchema.safeParse(await request.clone().json());
      if (!parsed.success)
        return Response.json(
          { message: 'Invalid registration data', code: 'INVALID_INPUT' },
          { status: 400 },
        );
    } catch {
      return Response.json({ message: 'Invalid JSON', code: 'INVALID_INPUT' }, { status: 400 });
    }
    if (publicDemo) {
      try {
        await demoLimit('registrations-global', 10, 86400);
      } catch {
        return Response.json(
          { code: 'DEMO_LIMIT', message: 'Demo registration limit reached.' },
          { status: 429 },
        );
      }
      const count = await getPool().query('SELECT count(*) AS n FROM "user"');
      if (Number(count.rows[0].n) >= 50)
        return Response.json(
          { code: 'DEMO_LIMIT', message: 'Demo capacity reached.' },
          { status: 429 },
        );
    }
  }
  return auth.handler(request);
}
export const GET = handler;
export const POST = handler;
