import { test, expect, type BrowserContext } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { headers, origin, testSql, clearRates, mailToken, mailLink, hash, grant, totp, enroll } from './security-helpers';
import { readCredentials } from '../scripts/demo-credentials';
import { checkMedia } from '../tests/media-check';
const accounts = readCredentials(process.env.ALATAU_TEST_CREDENTIALS!);
const seed = (role: string) => accounts.find(c => c.role === role)!;
const post = (c: BrowserContext, endpoint: string, data: unknown, extra = {}) => c.request.post('/api/auth/' + endpoint, {headers:{...headers,...extra},data});
const me = (c: BrowserContext) => c.request.get('/api/workspace?resource=requests');
test.describe.configure({mode:'serial'});

test('email verification is required, single-use, localized and bound to the link', async ({browser}) => {
  const c = await browser.newContext({baseURL:origin,ignoreHTTPSErrors:true});
  const email = `verify-${Date.now()}@example.test`, password = randomBytes(24).toString('hex');
  expect((await post(c,'sign-up/email',{name:'Security Test',email,password},{'x-alatau-locale':'kk'})).ok()).toBeTruthy();
  expect((await me(c)).status()).toBe(401);
  expect((await post(c,'sign-in/email',{email,password})).status()).toBe(403);
  const token = mailToken(email,'verify');
  const check = (value: string) => c.request.post('/api/account/verify-email',{headers,data:{token:value}});
  expect((await check(token + 'x')).status()).toBe(400);
  expect((await c.request.get('/api/auth/verify-email?token=invalid')).status()).toBe(404);
  const page = await c.newPage(); await page.setViewportSize({width:390,height:844});
  await page.goto(mailLink(email,'verify'));
  await expect(page.locator('html')).toHaveAttribute('lang','kk');
  await expect.poll(() => new URL(page.url()).hash).toBe('');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.locator('form button').click();
  await expect(page.getByText('Email расталды.',{exact:false})).toBeVisible();
  expect((await check(token)).status()).toBe(400);
  expect((await post(c,'sign-in/email',{email,password})).ok()).toBeTruthy();
  expect((await me(c)).ok()).toBeTruthy();
  await c.close();
});

test('expired verification links fail and verification state is enforced on existing sessions', async ({browser}) => {
  await clearRates();
  const c = await browser.newContext({baseURL:origin,ignoreHTTPSErrors:true});
  const email = `expired-${Date.now()}@example.test`,password=randomBytes(24).toString('hex');
  expect((await post(c,'sign-up/email',{name:'Expired Link',email,password})).ok()).toBeTruthy();
  const token=mailToken(email,'verify');
  await testSql('UPDATE auth_links SET "expiresAt"=0 WHERE id=$1',[hash(token)]);
  expect((await c.request.post('/api/account/verify-email',{headers,data:{token}})).status()).toBe(400);
  const buyer=seed('BUYER');
  expect((await post(c,'sign-in/email',{email:buyer.email,password:buyer.password})).ok()).toBeTruthy();
  await testSql('UPDATE "user" SET "emailVerified"=false WHERE id=$1',[buyer.id]);
  expect((await me(c)).status()).toBe(403);
  await testSql('UPDATE "user" SET "emailVerified"=true WHERE id=$1',[buyer.id]);
  await c.close();
});

test('password recovery is neutral, expires, changes password and revokes sessions', async ({browser}) => {
  await clearRates();
  const c=await browser.newContext({baseURL:origin,ignoreHTTPSErrors:true});
  const email=`reset-${Date.now()}@example.test`,password=randomBytes(24).toString('hex');
  expect((await post(c,'sign-up/email',{name:'Password Recovery',email,password})).ok()).toBeTruthy();
  expect((await c.request.post('/api/account/verify-email',{headers,data:{token:mailToken(email,'verify')}})).ok()).toBeTruthy();
  expect((await post(c,'sign-in/email',{email,password})).ok()).toBeTruthy();
  // Start a separate recovery window after signup's verification email.
  await clearRates();
  const known=await post(c,'request-password-reset',{email});
  const unknown=await post(c,'request-password-reset',{email:'unknown@example.test'});
  expect(known.status()).toBe(unknown.status()); expect(await known.json()).toEqual(await unknown.json());
  expect((await post(c,'request-password-reset',{email,redirectTo:'https://attacker.invalid'})).status()).toBe(403);
  const token=mailToken(email,'reset');
  const nextPassword=randomBytes(24).toString('hex');
  expect((await post(c,'reset-password',{token:token+'x',newPassword:nextPassword})).ok()).toBeFalsy();
  const page=await c.newPage(); await page.goto(mailLink(email,'reset'));
  await page.locator('[name=password]').fill(nextPassword); await page.locator('[name=confirm]').fill(nextPassword);
  await page.locator('form button').click();
  await expect(page.locator('.form-success')).toBeVisible();
  expect((await me(c)).status()).toBe(401);
  expect((await post(c,'reset-password',{token,newPassword:password})).ok()).toBeFalsy();
  expect((await post(c,'sign-in/email',{email,password})).ok()).toBeFalsy();
  expect((await post(c,'sign-in/email',{email,password:nextPassword})).ok()).toBeTruthy();
  // A new token is explicitly expired in the isolated test database.
  await clearRates();
  expect((await post(c,'request-password-reset',{email})).ok()).toBeTruthy();
  await testSql('UPDATE verification SET "expiresAt"=now()-interval \'1 minute\' WHERE identifier LIKE \'reset-password:%\'');
  const rows=await testSql('SELECT identifier FROM verification WHERE identifier LIKE \'reset-password:%\'');
  expect(rows.rowCount).toBeGreaterThan(0);
  const expired=rows.rows[0].identifier.slice('reset-password:'.length);
  expect((await post(c,'reset-password',{token:expired,newPassword:password})).ok()).toBeFalsy();
  await c.close();
});

test('staff enrollment, server gates, TOTP, single-use backups and account lockout', async ({browser}) => {
  await clearRates();
  const c=await browser.newContext({baseURL:origin,ignoreHTTPSErrors:true});
  const admin=seed('ADMIN');
  expect((await post(c,'sign-in/email',{email:admin.email,password:admin.password,mfaVerified:true})).ok()).toBeTruthy();
  expect((await me(c)).status()).toBe(403);
  const page=await c.newPage(); await page.goto('/ru/admin'); await expect(page).toHaveURL('/ru/security');
  expect((await post(c,'two-factor/enable',{password:admin.password})).status()).toBe(403);
  const expired=await grant(admin.id,Date.now()-1000);
  expect((await post(c,'two-factor/enable',{password:admin.password},{'x-mfa-enrollment':expired})).status()).toBe(403);
  const foreign=await grant(seed('SELLER').id);
  expect((await post(c,'two-factor/enable',{password:admin.password},{'x-mfa-enrollment':foreign})).status()).toBe(403);
  const code=await grant(admin.id);
  await page.locator('[name=enrollment]').fill(code); await page.locator('[name=password]').fill(admin.password);
  await page.locator('form button').click(); await expect(page.locator('.security-secret')).toBeVisible();
  const secret=await page.locator('.security-secret').textContent();
  const uri='otpauth://totp/test?secret='+secret;
  const backups=await page.locator('.security-material li code').allTextContents();
  expect(backups.length).toBeGreaterThan(1);
  expect((await me(c)).status()).toBe(403);
  expect((await post(c,'two-factor/enable',{password:admin.password},{'x-mfa-enrollment':code})).status()).toBe(403);
  await page.locator('input[type=checkbox]').check(); await page.locator('[name=code]').fill(await totp(uri));
  await page.locator('form button').click(); await expect(page).toHaveURL('/ru/admin');
  expect((await me(c)).ok()).toBeTruthy();
  const row=(await testSql('SELECT secret,"backupCodes" FROM "twoFactor" WHERE "userId"=$1',[admin.id])).rows[0];
  expect(row.secret.includes(secret)).toBeFalsy(); expect(row.backupCodes.includes(backups[0])).toBeFalsy();
  // Old password-only sessions cannot acquire access just because another session enrolled MFA.
  await testSql('UPDATE session SET "mfaVerified"=false WHERE "userId"=$1',[admin.id]);
  expect((await me(c)).status()).toBe(403);
  expect((await post(c,'two-factor/disable',{password:admin.password})).status()).toBe(404);
  await post(c,'sign-out',{}); await clearRates();
  const login=await post(c,'sign-in/email',{email:admin.email,password:admin.password});
  expect((await login.json()).twoFactorRedirect).toBe(true); expect((await me(c)).status()).toBe(401);
  expect((await post(c,'two-factor/verify-totp',{code:await totp(uri),trustDevice:true})).status()).toBe(403);
  expect((await post(c,'two-factor/verify-backup-code',{code:backups[0]})).ok()).toBeTruthy();
  expect((await me(c)).ok()).toBeTruthy();
  await post(c,'sign-out',{}); await clearRates();
  await post(c,'sign-in/email',{email:admin.email,password:admin.password});
  expect((await post(c,'two-factor/verify-backup-code',{code:backups[0]})).ok()).toBeFalsy();
  expect((await me(c)).status()).toBe(401);
  // Reset IP throttling between attempts to independently verify the account-wide lockout.
  for(let i=0;i<5;i++) {await clearRates();expect((await post(c,'two-factor/verify-totp',{code:'000000'})).ok()).toBeFalsy();}
  await clearRates();
  expect((await post(c,'two-factor/verify-totp',{code:await totp(uri)})).ok()).toBeFalsy();
  expect((await me(c)).status()).toBe(401);
  await c.close();
});

test('staff password reset preserves MFA; blocked users cannot finish a pending challenge', async ({browser}) => {
  await clearRates();
  const c=await browser.newContext({baseURL:origin,ignoreHTTPSErrors:true});
  const seller=seed('SELLER'), email=`staff-recovery-${Date.now()}@example.test`;
  await testSql('UPDATE "user" SET email=$1 WHERE id=$2',[email,seller.id]);
  expect((await post(c,'sign-in/email',{email,password:seller.password})).ok()).toBeTruthy();
  const factor=await enroll(c,seller.id,seller.password);
  expect((await me(c)).ok()).toBeTruthy();
  expect((await post(c,'request-password-reset',{email})).ok()).toBeTruthy();
  const password=randomBytes(24).toString('hex');
  expect((await post(c,'reset-password',{token:mailToken(email,'reset'),newPassword:password})).ok()).toBeTruthy();
  expect((await me(c)).status()).toBe(401);
  await clearRates();
  expect((await (await post(c,'sign-in/email',{email,password})).json()).twoFactorRedirect).toBe(true);
  expect((await me(c)).status()).toBe(401);
  expect((await post(c,'two-factor/verify-totp',{code:await totp(factor.totpURI)})).ok()).toBeTruthy();
  expect((await me(c)).ok()).toBeTruthy();
  await post(c,'sign-out',{}); await clearRates();
  await post(c,'sign-in/email',{email,password});
  await testSql('UPDATE "user" SET active=false WHERE id=$1',[seller.id]);
  expect((await post(c,'two-factor/verify-totp',{code:await totp(factor.totpURI)})).ok()).toBeFalsy();
  expect((await me(c)).status()).toBe(401);
  expect(Number((await testSql('SELECT count(*) AS n FROM session WHERE "userId"=$1',[seller.id])).rows[0].n)).toBe(0);
  await c.close();
});

test('mail throttling, Origin checks and BUYER cannot enroll staff MFA', async ({browser}) => {
  await clearRates();
  const c=await browser.newContext({baseURL:origin,ignoreHTTPSErrors:true});
  const buyer=seed('BUYER');
  await post(c,'sign-in/email',{email:buyer.email,password:buyer.password});
  expect((await post(c,'two-factor/enable',{password:buyer.password})).status()).toBe(403);
  expect((await c.request.post('/api/account/verify-email',{data:{token:'x'.repeat(40)}})).status()).toBe(403);
  for(let i=0;i<3;i++) expect((await post(c,'request-password-reset',{email:`throttle-${i}@example.test`})).ok()).toBeTruthy();
  expect((await post(c,'request-password-reset',{email:'throttle-last@example.test'})).status()).toBe(429);
  await c.close();
});

test('full buyer-admin-seller-buyer flow and media work behind verified MFA sessions', async ({browser}) => {
  await clearRates();
  const adminAccount = accounts.find(a => a.email === 'buyer-b@alatau.demo')!;
  const sellerAccount = accounts.find(a => a.email === 'seller-b@alatau.demo')!;
  const buyerAccount = accounts.find(a => a.email === 'buyer-a@alatau.demo')!;
  // Isolated fixture provisioning only; the public application cannot promote users.
  await testSql('UPDATE "user" SET role=\'ADMIN\' WHERE id=$1', [adminAccount.id]);
  const admin = await browser.newContext({baseURL:origin,ignoreHTTPSErrors:true});
  const seller = await browser.newContext({baseURL:origin,ignoreHTTPSErrors:true});
  const buyer = await browser.newContext({baseURL:origin,ignoreHTTPSErrors:true});
  const write = (c: BrowserContext, data: unknown) => c.request.post('/api/workspace', {headers,data});
  try {
    for (const [c, account] of [[admin, adminAccount], [seller, sellerAccount], [buyer, buyerAccount]] as const)
      expect((await post(c,'sign-in/email',{email:account.email,password:account.password})).ok()).toBeTruthy();
    expect((await admin.request.post('/api/media', {headers:{...headers,'Content-Type':'image/jpeg'},data:Buffer.from('invalid')})).status()).toBe(403);
    await enroll(admin, adminAccount.id, adminAccount.password);
    await enroll(seller, sellerAccount.id, sellerAccount.password);
    const created = await write(buyer, {action:'createRequest',lines:[{variantId:'d01-700',quantity:1,frame:true,hardware:false,installation:true}],note:'Strict security fixture'});
    expect(created.ok()).toBeTruthy(); const {id} = await created.json();
    expect((await seller.request.get('/api/workspace?resource=request&id='+id)).status()).toBe(404);
    expect((await write(admin,{action:'assign',requestId:id,sellerId:sellerAccount.id,revision:1})).ok()).toBeTruthy();
    expect((await write(seller,{action:'quote',requestId:id,revision:2})).ok()).toBeTruthy();
    const quote = await (await buyer.request.get('/api/workspace?resource=request&id='+id)).json();
    expect(quote.status).toBe('QUOTED'); expect(quote.quotes).toHaveLength(1);
    expect((await write(seller,{action:'status',requestId:id,status:'COMPLETED',revision:3})).ok()).toBeTruthy();
    expect((await (await buyer.request.get('/api/workspace?resource=request&id='+id)).json()).status).toBe('COMPLETED');
    await checkMedia(admin, buyer, seller, origin);
  } finally { await Promise.all([admin.close(),seller.close(),buyer.close()]); }
});
