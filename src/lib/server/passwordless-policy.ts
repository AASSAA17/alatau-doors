import { z } from 'zod';
import { createHash } from 'node:crypto';
import { getDb } from './db';
import { emailLoginReady, smsLoginReady } from './passwordless-delivery';
import { limitEntry } from './entry-limits';
import { sharedDemoAccount } from './public-demo';

export const passwordlessEndpoints = new Set(['email-otp/send-verification-otp', 'sign-in/email-otp', 'sign-in/magic-link', 'phone-number/send-otp', 'phone-number/verify', 'email-link']);
const email = z.email().max(254).transform((s) => s.toLowerCase());
const phoneNumber = z.string().regex(/^\+7[67]\d{9}$/);
const callback = z.string().regex(/^\/(ru|kk)\/(account|selection|sign-in)$/);
const schemas: Record<string, z.ZodType> = {
  'email-otp/send-verification-otp': z.object({ email, type: z.literal('sign-in') }).strict(),
  'sign-in/email-otp': z.object({ email, otp: z.string().regex(/^\d{6}$/), name: z.string().trim().min(2).max(100).optional() }).strict(),
  'sign-in/magic-link': z.object({ email, callbackURL: callback, newUserCallbackURL: callback, errorCallbackURL: callback }).strict(),
  'phone-number/send-otp': z.object({ phoneNumber }).strict(),
  'phone-number/verify': z.object({ phoneNumber, code: z.string().regex(/^\d{6}$/) }).strict(),
  'email-link': z.object({ token: z.string().min(20).max(256), callbackURL: callback, newUserCallbackURL: callback, errorCallbackURL: callback }).strict(),
};
export async function preparePasswordless(request: Request, endpoint: string): Promise<Request | Response> {
  if (request.method !== 'POST') return Response.json({ code: 'NOT_FOUND' }, { status: 404 });
  const sms = endpoint.startsWith('phone-number/');
  if (!(sms ? smsLoginReady() : emailLoginReady())) return Response.json({ code: 'UNAVAILABLE' }, { status: 503 });
  const input = schemas[endpoint].safeParse(await request.clone().json().catch(() => null));
  if (!input.success) return Response.json({ code: 'INVALID_INPUT' }, { status: 400 });
  const data = input.data as Record<string, string>;
  const send = ['email-otp/send-verification-otp', 'sign-in/magic-link', 'phone-number/send-otp'].includes(endpoint);
  try { await limitEntry(request, sms ? 'sms' : 'email', data.email || data.phoneNumber || data.token, send); }
  catch { return Response.json({ code: 'RATE_LIMIT' }, { status: 429 }); }
  let identity = data.email || data.phoneNumber;
  if (endpoint === 'email-link') {
    // Better Auth 1.7.14 namespaces hashed magic-link records this way. Validate
    // its record before redemption so legacy unverified passwords stay intact.
    const identifier = 'magic-link:' + createHash('sha256').update(data.token).digest('base64url');
    const record = await getDb().prepare('SELECT value FROM verification WHERE identifier=?').get(identifier) as { value: string } | undefined;
    if (!record) return Response.json({ code: 'AUTH_FAILED' }, { status: 400 });
    try { identity = z.object({ type: z.literal('magic-link'), email: z.email() }).parse(JSON.parse(record.value)).email.toLowerCase(); }
    catch { return Response.json({ code: 'AUTH_FAILED' }, { status: 400 }); }
  }
  if (identity) {
    const user = await getDb().prepare(sms ? 'SELECT role,active,email,emailVerified FROM user WHERE phoneNumber=?' : 'SELECT role,active,email,emailVerified FROM user WHERE lower(email)=?')
      .get(identity) as { role: string; active: boolean; email: string; emailVerified: boolean } | undefined;
    // Uniform acknowledgement for suppressed addresses; no staff recovery shortcut.
    if ((user && (user.role !== 'BUYER' || !user.active || sharedDemoAccount(user.email) || (!sms && !user.emailVerified))) || data.email?.endsWith('@phone.invalid'))
      return Response.json(send ? { status: true } : { code: 'AUTH_FAILED' }, { status: send ? 200 : 400 });
  }
  if (endpoint === 'email-link') {
    const url = new URL('/api/auth/magic-link/verify', request.url);
    url.search = new URLSearchParams(data).toString();
    return new Request(url, { headers: request.headers });
  }
  return new Request(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(data) });
}
