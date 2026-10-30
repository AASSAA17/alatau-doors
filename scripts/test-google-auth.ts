// Isolated provider simulator. Never loaded by the application or deployed routes.
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { Pool } from 'pg';

async function main() {
  for (const value of [process.env.DATABASE_URL, process.env.ALATAU_TEST_OWNER_URL]) {
    const url = new URL(value || 'https://invalid');
    assert(['127.0.0.1', 'localhost'].includes(url.hostname));
    assert(/^\/alatau_public_\d+_\d+$/.test(url.pathname));
  }
  assert(!process.env.VERCEL);
  assert.equal(process.env.GOOGLE_CLIENT_ID, 'local-test.apps.googleusercontent.com');
  const owner = new Pool({ connectionString: process.env.ALATAU_TEST_OWNER_URL });
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'fixture', alg: 'RS256', use: 'sig' };
  let email = 'google-buyer@example.test', verified = true, badAudience = false;
  let calls = 0, ip = 10;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    calls++;
    if (url === 'https://www.googleapis.com/oauth2/v3/certs') return Response.json({ keys: [jwk] });
    assert.equal(url, 'https://oauth2.googleapis.com/token', 'No real outbound provider requests allowed');
    const token = await new SignJWT({ email, email_verified: verified, name: 'Google fixture',
      picture: 'https://example.test/photo' })
      .setProtectedHeader({ alg: 'RS256', kid: 'fixture' }).setSubject(email)
      .setIssuer('https://accounts.google.com').setAudience(badAudience ? 'wrong' : process.env.GOOGLE_CLIENT_ID!)
      .setIssuedAt().setExpirationTime('5m').sign(privateKey);
    return Response.json({ access_token: 'fixture-access-token', id_token: token,
      expires_in: 3600, token_type: 'Bearer', scope: 'openid email profile' });
  };
  const { POST, GET } = await import('../src/app/api/auth/[...all]/route');
  const { auth } = await import('../src/lib/server/auth');
  const origin = process.env.BETTER_AUTH_URL!;
  const body = { provider: 'google', callbackURL: '/ru/account', errorCallbackURL: '/ru/sign-in?google=error' };
  const cookies = (r: Response) => r.headers.getSetCookie().map(s => s.split(';')[0]).join('; ');
  const post = (data: unknown, requestOrigin = origin, cookie = '') => POST(new Request(`${origin}/api/auth/sign-in/social`, {
    method: 'POST', headers: { origin: requestOrigin, 'content-type': 'application/json', cookie,
      'x-forwarded-for': `127.0.1.${ip++}` }, body: JSON.stringify(data),
  }));
  async function start() {
    const r = await post(body);
    assert.equal(r.status, 200);
    const url = new URL((await r.json()).url);
    assert.equal(url.origin, 'https://accounts.google.com');
    assert.equal(url.searchParams.get('redirect_uri'), `${origin}/api/auth/callback/google`);
    assert.deepEqual(url.searchParams.get('scope')!.split(' ').sort(), ['email', 'openid', 'profile']);
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(url.searchParams.get('access_type'), 'online');
    return { state: url.searchParams.get('state')!, cookie: cookies(r) };
  }
  const finish = (flow: { state: string; cookie: string }) => GET(new Request(
    `${origin}/api/auth/callback/google?code=fixture&state=${encodeURIComponent(flow.state)}`,
    { headers: { cookie: flow.cookie, 'x-forwarded-for': `127.0.1.${ip++}` } },
  ));
  const session = (r: Response) => auth.api.getSession({ headers: new Headers({ cookie: cookies(r) }) });
  try {
    for (const extra of [{ role: 'ADMIN' }, { idToken: { token: 'fake' } }, { scopes: ['gmail'] },
      { callbackURL: 'https://example.test' }, { provider: 'github' }]) {
      assert.equal((await post({ ...body, ...extra })).status, 400);
    }
    assert.equal((await post(body, 'https://example.test')).status, 403);
    const flow = await start();
    const before = calls;
    assert.equal(await session(await finish({ ...flow, cookie: '' })), null);
    assert.equal(calls, before, 'State cookie is checked before token exchange');
    const ok = await finish(await start());
    const signedIn = await session(ok);
    assert.equal(signedIn?.user.role, 'BUYER');
    assert.equal(signedIn?.user.emailVerified, true);
    assert.equal(signedIn?.user.image, null);
    assert.equal((await post(body, origin, cookies(ok))).status, 409);
    const account = (await owner.query('SELECT "accessToken","idToken" FROM account WHERE "userId"=$1', [signedIn!.user.id])).rows[0];
    assert(account.accessToken && account.accessToken !== 'fixture-access-token');
    assert.equal(account.idToken, null, 'Profile JWT is discarded after validation');
    const count = async () => Number((await owner.query("SELECT count FROM demo_limits WHERE key='registrations-global'")).rows[0]?.count || 0);
    assert.equal(await count(), 1);
    const reused = await start();
    assert(await session(await finish(reused)));
    assert.equal(await session(await finish(reused)), null);
    assert.equal(await count(), 1, 'Returning users do not consume signup quota');
    for (const role of ['ADMIN', 'SELLER']) {
      await owner.query('UPDATE "user" SET role=$1 WHERE id=$2', [role, signedIn!.user.id]);
      assert.equal(await session(await finish(await start())), null, `${role} cannot use Google`);
    }
    await owner.query('UPDATE "user" SET role=$1,active=false WHERE id=$2', ['BUYER', signedIn!.user.id]);
    assert.equal(await session(await finish(await start())), null);
    email = 'admin@alatau.demo';
    assert.equal(await session(await finish(await start())), null, 'Password identities cannot be linked by matching email');
    assert.equal(Number((await owner.query('SELECT count(*) AS n FROM account WHERE "providerId"=$1', ['google'])).rows[0].n), 1);
    email = 'unverified@example.test'; verified = false;
    assert.equal(await session(await finish(await start())), null);
    assert.equal(Number((await owner.query('SELECT count(*) AS n FROM "user" WHERE email=$1', [email])).rows[0].n), 0);
    verified = true; badAudience = true;
    assert.equal(await session(await finish(await start())), null);
    badAudience = false;
    await owner.query("UPDATE demo_limits SET count=10 WHERE key='registrations-global'");
    assert.equal(await session(await finish(await start())), null, 'Google obeys daily signup quota');
    await owner.query("UPDATE demo_limits SET count=0 WHERE key='registrations-global'");
    console.log('Google OAuth: signed token/audience/state checks, BUYER-only sessions, disabled accounts, no linking, encrypted tokens, origin/redirect restrictions and shared quota passed (simulated provider).');
  } finally {
    globalThis.fetch = originalFetch;
    await owner.end();
    const { getPool } = await import('../src/lib/server/db');
    await getPool().end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
