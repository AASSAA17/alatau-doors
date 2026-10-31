// Provider contract simulation, only in a fresh loopback PostgreSQL test database.
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { readCredentials } from './demo-credentials';

async function main() {
  for (const value of [process.env.DATABASE_URL, process.env.ALATAU_TEST_OWNER_URL]) {
    const url = new URL(value || 'https://invalid');
    assert(['127.0.0.1', 'localhost'].includes(url.hostname) && /^\/alatau_public_\d+_\d+$/.test(url.pathname));
  }
  assert(!process.env.VERCEL);
  Object.assign(process.env, { AUTH_MAIL_PROVIDER: 'resend', RESEND_API_KEY: 'local-provider-fixture', AUTH_MAIL_FROM: 'demo@example.test',
    AUTH_SMS_PROVIDER: 'twilio-verify', AUTH_SMS_ENABLED: 'true', TWILIO_ACCOUNT_SID: 'local-fixture', TWILIO_AUTH_TOKEN: 'local-fixture', TWILIO_VERIFY_SERVICE_SID: 'VA' + '0'.repeat(32) });
  const owner = new Pool({ connectionString: process.env.ALATAU_TEST_OWNER_URL });
  const original = globalThis.fetch;
  let mail = '', failDelivery = false, calls = 0;
  const smsPending = new Set<string>();
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls++;
    if (failDelivery) return Response.json({}, { status: 503 });
    if (url === 'https://api.resend.com/emails') { mail = JSON.parse(String(init!.body)).text; return Response.json({ id: 'fixture' }); }
    assert(url.startsWith('https://verify.twilio.com/v2/Services/VA' + '0'.repeat(32) + '/'), 'No real provider calls');
    const body = new URLSearchParams(String(init!.body)), phone = body.get('To')!;
    if (url.endsWith('/Verifications')) { smsPending.add(phone); return Response.json({ status: 'pending' }); }
    const valid = body.get('Code') === '654321' && smsPending.delete(phone);
    return Response.json({ status: valid ? 'approved' : 'pending', valid });
  };
  const { POST, GET } = await import('../src/app/api/auth/[...all]/route');
  const guest = await import('../src/app/api/guest/route');
  const { auth } = await import('../src/lib/server/auth');
  const origin = process.env.BETTER_AUTH_URL!;
  let ip = 1;
  const cookies = (r: Response) => r.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
  function req(path: string, body: unknown, cookie = '', method = 'POST', source = origin) {
    return new Request(origin + path, { method, headers: { origin: source, 'content-type': 'application/json', cookie, 'x-forwarded-for': `127.0.7.${ip++}` }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) });
  }
  const post = (path: string, body: unknown, cookie = '') => POST(req('/api/auth/' + path, body, cookie));
  const session = (r: Response) => auth.api.getSession({ headers: new Headers({ cookie: cookies(r) }) });
  const clearLimits = () => owner.query('DELETE FROM entry_limits');
  const sendCode = (email: string) => post('email-otp/send-verification-otp', { email, type: 'sign-in' });
  const otp = () => mail.match(/\b\d{6}\b/)![0];
  try {
    assert.equal((await POST(req('/api/auth/email-otp/send-verification-otp', { email: 'x@example.test', type: 'sign-in' }, '', 'POST', 'https://evil.test'))).status, 403);
    for (const extra of [{ type: 'forget-password' }, { role: 'ADMIN' }]) assert.equal((await post('email-otp/send-verification-otp', { email: 'x@example.test', type: 'sign-in', ...extra })).status, 400);
    assert.equal((await GET(req('/api/auth/magic-link/verify?token=anything', null, '', 'GET'))).status, 404);
    const email = 'otp-new@example.test';
    assert.equal((await sendCode(email)).status, 200);
    const code = otp();
    const stored = (await owner.query('SELECT value FROM verification WHERE identifier LIKE $1', ['%' + email + '%'])).rows;
    assert(stored.length && stored.every(r => !r.value.includes(code)), 'Codes are stored as keyed digests');
    assert.equal((await sendCode(email)).status, 429, 'Resend cooldown');
    const ok = await post('sign-in/email-otp', { email, otp: code });
    assert.equal(ok.status, 200);
    const buyer = await session(ok);
    assert.equal(buyer?.user.role, 'BUYER'); assert.equal(buyer?.user.emailVerified, true);
    assert.equal(await session(await post('sign-in/email-otp', { email, otp: code })), null, 'Single-use code');
    assert.equal((await sendCode('different@example.test')).status, 200);
    const nextCode = otp(), wrong = nextCode === '000000' ? '111111' : '000000';
    for (let i = 0; i < 3; i++) assert.equal(await session(await post('sign-in/email-otp', { email: 'different@example.test', otp: wrong })), null);
    await clearLimits();
    assert.equal(await session(await post('sign-in/email-otp', { email: 'different@example.test', otp: nextCode })), null, 'Attempt limit invalidates the correct code too');
    await clearLimits();
    await sendCode('expired@example.test');
    const expiredCode = otp();
    await owner.query('UPDATE verification SET "expiresAt"=now()-interval \'1 minute\' WHERE identifier LIKE $1', ['%expired@example.test%']);
    assert.equal(await session(await post('sign-in/email-otp', { email: 'expired@example.test', otp: expiredCode })), null, 'Expired code');
    await clearLimits();
    const before = calls;
    for (const email of ['admin@alatau.demo', 'seller-a@alatau.demo', 'buyer-a@alatau.demo']) assert.equal((await sendCode(email)).status, 200);
    assert.equal(calls, before, 'Shared/staff addresses never trigger delivery');
    await clearLimits();
    const linkBody = { email: 'magic-new@example.test', callbackURL: '/kk/account', newUserCallbackURL: '/kk/account', errorCallbackURL: '/kk/sign-in' };
    assert.equal((await post('sign-in/magic-link', { ...linkBody, callbackURL: 'https://evil.test' })).status, 400);
    assert.equal((await post('sign-in/magic-link', linkBody)).status, 200);
    const link = new URL(mail.match(/https:\/\/\S+/)![0]);
    assert.equal(link.pathname, '/ru/email-link'); assert(!link.search); assert(link.hash);
    const payload = Object.fromEntries(new URLSearchParams(link.hash.slice(1)));
    const results = await Promise.all([post('email-link', payload), post('email-link', payload)]);
    assert.equal(results.filter(r => r.ok).length, 1, 'Parallel magic link redemption creates one session');
    const linked = results.find(r => r.ok)!; assert.equal((await session(linked))?.user.role, 'BUYER');
    assert.equal((await linked.json()).destination, '/kk/account');
    // A link issued before the account becomes staff must not create a staff session.
    await clearLimits();
    assert.equal((await post('sign-in/magic-link', linkBody)).status, 200);
    const pending = Object.fromEntries(new URLSearchParams(new URL(mail.match(/https:\/\/\S+/)![0]).hash.slice(1)));
    await owner.query('UPDATE "user" SET role=$1 WHERE email=$2', ['SELLER', linkBody.email]);
    assert.equal((await post('email-link', pending)).status, 400);
    await owner.query('UPDATE "user" SET role=$1 WHERE email=$2', ['BUYER', linkBody.email]);
    await clearLimits();
    const legacyEmail = 'legacy-password@example.test';
    const legacy = await post('sign-up/email', { name: 'Legacy Buyer', phone: '+77001234567', email: legacyEmail, password: 'Only-a-local-fixture-password-42' });
    assert.equal(legacy.status, 200);
    const legacyUser = await session(legacy);
    const passwordBefore = (await owner.query('SELECT password FROM account WHERE "userId"=$1', [legacyUser!.user.id])).rows[0].password;
    const deliveryBefore = calls;
    assert.equal((await sendCode(legacyEmail)).status, 200); assert.equal(calls, deliveryBefore);
    assert.equal((await owner.query('SELECT password FROM account WHERE "userId"=$1', [legacyUser!.user.id])).rows[0].password, passwordBefore);
    assert(await session(legacy), 'Legacy unverified password/session preserved');
    await clearLimits();
    assert.equal((await post('phone-number/send-otp', { phoneNumber: '+12025550123' })).status, 400);
    const phoneNumber = '+77001112233';
    assert.equal((await post('phone-number/send-otp', { phoneNumber })).status, 200);
    assert.equal((await post('phone-number/verify', { phoneNumber, code: '654321', role: 'ADMIN' })).status, 400);
    const sms = await post('phone-number/verify', { phoneNumber, code: '654321' });
    assert.equal(sms.status, 200);
    const smsBuyer = await session(sms);
    assert.equal(smsBuyer?.user.role, 'BUYER'); assert.equal(smsBuyer?.user.phoneNumberVerified, true);
    assert.equal(smsBuyer?.user.emailVerified, false);
    assert.equal(await session(await post('phone-number/verify', { phoneNumber, code: '654321' })), null);
    await owner.query('UPDATE "user" SET role=$1 WHERE id=$2', ['ADMIN', smsBuyer!.user.id]);
    await clearLimits();
    const smsBefore = calls;
    await post('phone-number/send-otp', { phoneNumber }); assert.equal(calls, smsBefore);
    await owner.query('UPDATE "user" SET role=$1,active=false WHERE id=$2', ['BUYER', buyer!.user.id]);
    const disabledBefore = calls; await sendCode(email); assert.equal(calls, disabledBefore);
    await clearLimits(); failDelivery = true;
    assert((await sendCode('delivery-fail@example.test')).status >= 400, 'Delivery failure is not reported as sent');
    failDelivery = false;
    delete process.env.AUTH_MAIL_PROVIDER;
    assert.equal((await sendCode('unconfigured@example.test')).status, 503);
    delete process.env.AUTH_SMS_ENABLED;
    assert.equal((await post('phone-number/send-otp', { phoneNumber })).status, 503);

    const accounts = readCredentials(process.env.ALATAU_TEST_CREDENTIALS!);
    const staff: Record<string, string> = {};
    for (const key of ['admin', 'seller-a', 'seller-b', 'buyer-a']) {
      const account = accounts.find(a => a.email === `${key}@alatau.demo`)!;
      const response = await post('sign-in/email', { email: account.email, password: account.password });
      assert.equal(response.status, 200); staff[key] = cookies(response);
    }
    await clearLimits();
    const input = { name: 'Fictional Guest', contact: 'guest@example.test', note: 'Test interior doors', locale: 'ru', consent: true, website: '' };
    const usersBefore = (await owner.query('SELECT count(*) AS n FROM "user"')).rows[0].n;
    assert.equal((await guest.POST(req('/api/guest', input, '', 'POST', 'https://evil.test'))).status, 403);
    assert.equal((await guest.POST(req('/api/guest', { ...input, consent: false }))).status, 400);
    const created = await guest.POST(req('/api/guest', input)); assert.equal(created.status, 201);
    const { id } = await created.json();
    assert.equal((await owner.query('SELECT count(*) AS n FROM "user"')).rows[0].n, usersBefore);
    assert.equal((await guest.GET(req('/api/guest', null, '', 'GET'))).status, 401);
    assert.equal((await guest.GET(req('/api/guest', null, staff['buyer-a'], 'GET'))).status, 403);
    const sellerId = (await owner.query('SELECT id FROM "user" WHERE email=$1', ['seller-a@alatau.demo'])).rows[0].id;
    const update = { id, revision: 1, status: 'IN_PROGRESS', sellerId };
    assert.equal((await guest.PATCH(req('/api/guest', update, staff['seller-b'], 'PATCH'))).status, 404);
    assert.equal((await guest.PATCH(req('/api/guest', update, staff.admin, 'PATCH'))).status, 200);
    assert.equal((await guest.PATCH(req('/api/guest', update, staff.admin, 'PATCH'))).status, 409);
    assert((await (await guest.GET(req('/api/guest', null, staff['seller-a'], 'GET'))).json()).some((r: { id: string }) => r.id === id));
    assert(!(await (await guest.GET(req('/api/guest', null, staff['seller-b'], 'GET'))).json()).some((r: { id: string }) => r.id === id));
    assert.equal((await guest.PATCH(req('/api/guest', { ...update, revision: 2, status: 'COMPLETED' }, staff['seller-a'], 'PATCH'))).status, 200);
    assert.equal(Number((await owner.query('SELECT count(*) AS n FROM audit_log WHERE "targetId"=$1', [id])).rows[0].n), 2);
    await owner.query("UPDATE demo_limits SET count=0 WHERE key='registrations-global'");
    console.log('Entry methods passed: email OTP, one-use magic links, SMS provider contract, role restrictions, delivery gating, guest/admin/assigned seller workflow and audit. No real messages sent.');
  } finally {
    globalThis.fetch = original; await owner.end();
    const { getPool } = await import('../src/lib/server/db'); await getPool().end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
