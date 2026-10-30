import { auth, trustedOrigins } from '@/lib/server/auth';
import { registerSchema } from '@/lib/server/schemas';
import { ensureDatabaseMode, getPool, getDb } from '@/lib/server/db';
import { publicDemo } from '@/lib/server/environment';
import { demoLimit, sharedDemoAccount } from '@/lib/server/public-demo';
import { boundedText, BodyTooLarge } from '@/lib/server/request-body';
import { googleConfigured } from '@/lib/server/google-auth';
import { z } from 'zod';
import { passwordlessEndpoints, preparePasswordless } from '@/lib/server/passwordless-policy';
import { deliveryContext } from '@/lib/server/passwordless-delivery';
import { accountSecurityRequired, staffRole } from '@/lib/server/auth-policy';
import { mailReady, tokenDigest } from '@/lib/server/auth-mail';
import { createHmac } from 'node:crypto';
import { limitEntry } from '@/lib/server/entry-limits';
export const runtime = 'nodejs';
const allowed = new Set([
  'sign-in/email',
  'sign-up/email',
  'sign-out',
  'get-session',
  'change-password',
  'sign-in/social',
  'callback/google',
  ...passwordlessEndpoints,
  'request-password-reset', 'reset-password', 'send-verification-email',
  'two-factor/enable', 'two-factor/verify-totp', 'two-factor/verify-backup-code', 'two-factor/generate-backup-codes',
]);
async function handler(request: Request) {
  await ensureDatabaseMode();
  const endpoint = new URL(request.url).pathname.split('/api/auth/')[1];
  if (!allowed.has(endpoint)) return Response.json({ code: 'NOT_FOUND' }, { status: 404 });
  if (endpoint.startsWith('two-factor/') && !accountSecurityRequired)
    return Response.json({ code: 'NOT_FOUND' }, { status: 404 });
  if (['sign-in/social', 'callback/google'].includes(endpoint) && !googleConfigured)
    return Response.json({ code: 'NOT_FOUND' }, { status: 404 });
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
  let payload: Record<string, unknown> = {};
  if (request.method === 'POST') {
    if (!trustedOrigins.includes(request.headers.get('origin') || ''))
      return Response.json({ code: 'FORBIDDEN' }, { status: 403 });
    try {
      const body = await boundedText(request, 16384);
      payload = body ? z.record(z.string(), z.unknown()).parse(JSON.parse(body)) : {};
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
  const mailEndpoint = ['request-password-reset', 'send-verification-email'].includes(endpoint) ||
    (accountSecurityRequired && endpoint === 'sign-up/email');
  if (request.method === 'POST' && mailEndpoint) {
    if (!mailReady()) return Response.json({code:'AUTH_MAIL_UNAVAILABLE'}, {status:503});
    const email = z.email().max(254).safeParse(payload.email);
    if (!email.success) return Response.json({code:'INVALID_INPUT'}, {status:400});
    for (const key of ['callbackURL', 'redirectTo']) {
      if (payload[key] !== undefined) {
        try { if (new URL(String(payload[key]), process.env.BETTER_AUTH_URL).origin !== process.env.BETTER_AUTH_URL) throw new Error(); }
        catch { return Response.json({code:'FORBIDDEN'}, {status:403}); }
      }
    }
    try {
      await limitEntry(request, 'account-mail', email.data.toLowerCase(), true);
      const key = createHmac('sha256', process.env.BETTER_AUTH_SECRET!).update(email.data.toLowerCase()).digest('hex');
      await demoLimit('mail-target:' + key, 6, 3600);
      await demoLimit('mail-global', 100, 3600);
    } catch { return Response.json({code:'DEMO_LIMIT'}, {status:429}); }
  }
  const verification = ['two-factor/verify-totp', 'two-factor/verify-backup-code'].includes(endpoint);
  let priorSession: Awaited<ReturnType<typeof auth.api.getSession>> = null;
  if (request.method === 'POST' && (endpoint.startsWith('two-factor/') || endpoint === 'change-password')) {
    priorSession = await auth.api.getSession({headers: request.headers});
    if (endpoint.startsWith('two-factor/')) {
      // All sign-ins require a fresh challenge; trusted-device bypass is not supported.
      if (payload.trustDevice || (endpoint === 'two-factor/enable' && payload.method && payload.method !== 'totp'))
        return Response.json({code:'FORBIDDEN'}, {status:403});
      if (!verification && (!priorSession || !staffRole(priorSession.user.role)))
        return Response.json({code:'FORBIDDEN'}, {status:403});
    }
    if (priorSession && accountSecurityRequired && staffRole(priorSession.user.role) &&
        ['change-password', 'two-factor/generate-backup-codes'].includes(endpoint) && !priorSession.session.mfaVerified)
      return Response.json({code:'MFA_REQUIRED'}, {status:403});
    if (endpoint === 'two-factor/enable' && priorSession) {
      if (!priorSession.user.emailVerified) return Response.json({code:'EMAIL_NOT_VERIFIED'}, {status:403});
      const grant = z.string().min(32).max(128).safeParse(request.headers.get('x-mfa-enrollment'));
      if (!grant.success) return Response.json({code:'MFA_ENROLLMENT_REQUIRED'}, {status:403});
      const consumed = await getDb().prepare('DELETE FROM mfa_enrollments WHERE userId=? AND tokenHash=? AND expiresAt>? RETURNING userId')
        .get(priorSession.user.id, tokenDigest(grant.data), Date.now());
      if (!consumed) return Response.json({code:'MFA_ENROLLMENT_REQUIRED'}, {status:403});
    }
  }
  if (endpoint === 'sign-in/social' && request.method === 'POST') {
    const localPath = z.string().regex(/^\/(ru|kk)\/(account|selection|sign-in)(\?google=error)?$/);
    const input = z.object({
      provider: z.literal('google'), callbackURL: localPath,
      errorCallbackURL: localPath, newUserCallbackURL: localPath.optional(),
    }).strict().safeParse(await request.clone().json().catch(() => null));
    // Browser redirects only: no client-supplied ID tokens, scopes, roles or linking.
    if (!input.success) return Response.json({ code: 'INVALID_INPUT' }, { status: 400 });
    const session = await auth.api.getSession({ headers: request.headers });
    if (session) return Response.json({ code: 'SIGN_OUT_FIRST' }, { status: 409 });
  }
  if (passwordlessEndpoints.has(endpoint)) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session) return Response.json({ code: 'SIGN_OUT_FIRST' }, { status: 409 });
    const prepared = await preparePasswordless(request, endpoint);
    if (prepared instanceof Response) return prepared;
    request = prepared;
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
  let response: Response;
  const delivery = { failed: false };
  try { response = await deliveryContext.run(delivery, () => auth.handler(request)); }
  catch { return Response.json({ code: 'AUTH_FAILED' }, { status: 400 }); }
  if (delivery.failed) return Response.json({ code: 'DELIVERY_FAILED' }, { status: 503 });
  if (response.ok && verification && priorSession) {
    await getDb().prepare('UPDATE session SET mfaVerified=? WHERE id=?').run(true, priorSession.session.id);
  }
  if (accountSecurityRequired && endpoint === 'sign-up/email' && response.status === 400) {
    const error = await response.clone().json().catch(() => null);
    if (['USER_ALREADY_EXISTS', 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'].includes(error?.code)) return Response.json({status:true});
  }
  if (endpoint === 'email-link') {
    const location = response.headers.get('location');
    const destination = location ? new URL(location, request.url) : null;
    const valid = destination && destination.origin === new URL(request.url).origin &&
      /^\/(ru|kk)\/(account|selection)$/.test(destination.pathname) && !destination.search;
    const headers = new Headers(response.headers);
    headers.delete('location');
    headers.set('Cache-Control', 'private, no-store');
    return Response.json(valid ? { destination: destination!.pathname } : { code: 'AUTH_FAILED' }, { status: valid ? 200 : 400, headers });
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const GET = handler;
export const POST = handler;
