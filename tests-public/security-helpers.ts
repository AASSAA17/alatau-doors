import { Pool } from 'pg';
import { randomBytes, createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createOTP } from '@better-auth/utils/otp';
import { base32 } from '@better-auth/utils/base32';
import { expect, type BrowserContext } from '@playwright/test';
export const origin = 'https://127.0.0.1:3343';
export const headers = { Origin: origin };
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function testSql(sql: string, values: unknown[] = []) {
  const url = new URL(process.env.ALATAU_TEST_OWNER_URL!);
  if (process.env.VERCEL || !process.env.ALATAU_TEST_RUN || !['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.startsWith('/alatau_public_')) throw new Error('Isolated test database required');
  const pool = new Pool({ connectionString: url.toString() });
  try {return await pool.query(sql, values);} finally {await pool.end();}
}
export async function clearRates() { await testSql('DELETE FROM "rateLimit"'); await testSql('DELETE FROM entry_limits'); }
export function mailLink(email: string, purpose: string) {
  const dir = resolve(process.env.AUTH_TEST_MAIL_DIR!);
  if (!dir.startsWith(resolve('.local') + sep)) throw new Error('Test mailbox must be local');
  const found = readdirSync(dir).map(name => JSON.parse(readFileSync(resolve(dir, name), 'utf8')))
    .find(mail => mail.to === email && mail.purpose === purpose);
  if (!found) throw new Error('Expected test mail was not delivered');
  return found.url as string;
}
export function mailToken(email: string, purpose: string) { return new URLSearchParams(new URL(mailLink(email, purpose)).hash.slice(1)).get('token')!; }
export function mailCode(email: string) {
  const dir = resolve(process.env.AUTH_TEST_MAIL_DIR!);
  if (!dir.startsWith(resolve('.local') + sep)) throw new Error('Test mailbox must be local');
  const found = readdirSync(dir).map(name => ({at:statSync(resolve(dir,name)).mtimeMs, ...JSON.parse(readFileSync(resolve(dir,name),'utf8'))}))
    .filter(mail => mail.to === email && mail.purpose === 'verify-code').sort((a,b)=>b.at-a.at)[0];
  if (!found || !/^\d{6}$/.test(found.code)) throw new Error('Expected six-digit test code');
  return found.code as string;
}
export async function grant(id: string, expiresAt = Date.now() + 900000) {
  const code = randomBytes(32).toString('base64url');
  await testSql('INSERT INTO mfa_enrollments("userId","tokenHash","expiresAt") VALUES($1,$2,$3) ON CONFLICT("userId") DO UPDATE SET "tokenHash"=excluded."tokenHash","expiresAt"=excluded."expiresAt"', [id, hash(code), expiresAt]);
  return code;
}
export const totp = (uri: string) => createOTP(base32.decode(new URL(uri).searchParams.get('secret')!)).totp();
export async function enroll(context: BrowserContext, id: string, password: string) {
  await clearRates();
  const enabled = await context.request.post('/api/auth/two-factor/enable', { headers: {...headers, 'x-mfa-enrollment':await grant(id)}, data:{password, method:'totp'} });
  expect(enabled.ok()).toBeTruthy();
  const result = await enabled.json();
  const verified = await context.request.post('/api/auth/two-factor/verify-totp', {headers, data:{code:await totp(result.totpURI), trustDevice:false}});
  expect(verified.ok()).toBeTruthy();
  return result as {totpURI:string;backupCodes:string[]};
}
