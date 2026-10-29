import { test, expect, type BrowserContext } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { readCredentials } from '../scripts/demo-credentials';
import type { AdminProduct, RequestDetail } from '../src/types/workspace';
const origin = 'https://127.0.0.1:3343';
const accounts = readCredentials(process.env.ALATAU_TEST_CREDENTIALS!);
const credential = (key: string) => accounts.find((c) => c.email === `${key}@alatau.demo`)!;
const sessions: Record<string, BrowserContext> = {};
const line = {
  variantId: 'd01-700',
  quantity: 2,
  frame: true,
  hardware: true,
  installation: false,
};
const read = (context: BrowserContext, resource: string, id = '') =>
  context.request.get(`/api/workspace?resource=${resource}&id=${id}`);
const write = (context: BrowserContext, data: unknown, source = origin) =>
  context.request.post('/api/workspace', { data, headers: { Origin: source } });
const detail = async (context: BrowserContext, id: string): Promise<RequestDetail> => {
  const response = await read(context, 'request', id);
  expect(response.ok()).toBeTruthy();
  return response.json();
};
test.describe.configure({ mode: 'serial' });
test.beforeAll(async ({ browser }) => {
  for (const key of ['admin', 'buyer-a', 'buyer-b', 'seller-a', 'seller-b']) {
    const context = await browser.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
    sessions[key] = context;
    const c = credential(key);
    expect(
      (
        await context.request.post('/api/auth/sign-in/email', {
          data: { email: c.email, password: c.password },
          headers: { Origin: origin },
        })
      ).ok(),
    ).toBeTruthy();
  }
});
test.afterAll(async () => {
  await Promise.all(Object.values(sessions).map((c) => c.close()));
});

test('HTTPS cookies and invitation registration; session and favorite survive a fresh browser context', async ({
  browser,
}) => {
  const c = await browser.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  const email = `invited-${Date.now()}@alatau.demo`,
    password = randomBytes(24).toString('base64url');
  const body = { email, password, name: 'Invited Fictional Buyer' };
  const headers = { Origin: origin, 'x-demo-invite': process.env.DEMO_INVITE_CODE! };
  expect(
    (
      await c.request.post('/api/auth/sign-up/email', { data: body, headers: { Origin: origin } })
    ).status(),
  ).toBe(403);
  expect(
    (
      await c.request.post('/api/auth/sign-up/email', { data: { ...body, role: 'ADMIN' }, headers })
    ).status(),
  ).toBe(400);
  expect(
    (
      await c.request.post('/api/auth/sign-up/email', {
        data: body,
        headers: { ...headers, Origin: 'https://attacker.invalid' },
      })
    ).status(),
  ).toBe(403);
  const page = await c.newPage();
  await page.goto('/kk/sign-up');
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await page.locator('[name=invitation]').fill(process.env.DEMO_INVITE_CODE!);
  await page.locator('[name=name]').fill(body.name);
  await page.locator('[name=email]').fill(email);
  await page.locator('[name=password]').fill(password);
  await page.locator('form button[type=submit], form button.primary-button').click();
  await expect(page).toHaveURL('/kk/account');
  expect((await (await read(c, 'me')).json()).actor.role).toBe('BUYER');
  const cookie = (await c.cookies()).find((cookie) => cookie.name.endsWith('session_token'))!;
  expect(cookie).toMatchObject({ secure: true, httpOnly: true, sameSite: 'Lax' });
  expect(cookie.name).toMatch(/^__Secure-/);
  expect((await write(c, { action: 'favorite', productId: 'd02', saved: true })).ok()).toBeTruthy();
  const state = await c.storageState();
  await c.close();
  const restored = await browser.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
    storageState: state,
  });
  expect((await (await read(restored, 'favorites')).json()).ids).toContain('d02');
  expect((await read(restored, 'users')).status()).toBe(403);
  expect(
    (
      await restored.request.post('/api/auth/change-password', {
        headers: { Origin: origin },
        data: {
          currentPassword: password,
          newPassword: randomBytes(24).toString('base64url'),
          revokeOtherSessions: true,
        },
      })
    ).ok(),
  ).toBeTruthy();
  await restored.close();
});

test('BUYER → ADMIN → SELLER → BUYER over HTTPS; competing revisions and private history', async () => {
  const buyer = sessions['buyer-a'],
    other = sessions['buyer-b'],
    admin = sessions.admin,
    seller = sessions['seller-a'];
  const created = await write(buyer, {
    action: 'createRequest',
    lines: [line],
    note: 'Fictional public demo workflow',
  });
  expect(created.ok()).toBeTruthy();
  const id = (await created.json()).id;
  expect((await read(other, 'request', id)).status()).toBe(404);
  expect((await read(sessions['seller-b'], 'request', id)).status()).toBe(404);
  expect(
    (
      await write(buyer, {
        action: 'assign',
        requestId: id,
        sellerId: credential('seller-a').id,
        revision: 1,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await write(admin, {
        action: 'assign',
        requestId: id,
        sellerId: credential('seller-a').id,
        revision: 1,
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await write(seller, {
        action: 'comment',
        requestId: id,
        text: 'PUBLIC_TEST_PRIVATE_SENTINEL',
      })
    ).ok(),
  ).toBeTruthy();
  const responses = await Promise.all(
    [1, 2].map(() => write(seller, { action: 'quote', requestId: id, revision: 2 })),
  );
  expect(responses.map((r) => r.status()).sort()).toEqual([200, 409]);
  const result = await detail(buyer, id);
  expect(result.status).toBe('QUOTED');
  expect(result.quotes).toHaveLength(1);
  expect(result.events.map((e) => e.kind)).toEqual(['CREATED', 'ASSIGNED', 'QUOTED']);
  expect(JSON.stringify(result)).not.toContain('PUBLIC_TEST_PRIVATE_SENTINEL');
  expect(result).not.toHaveProperty('comments');
  const page = await buyer.newPage();
  await page.goto(`/ru/requests/${id}`);
  await expect(page.getByTestId('saved-quote-total')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('PUBLIC_TEST_PRIVATE_SENTINEL');
  await page.close();
  expect(
    (
      await write(seller, { action: 'status', requestId: id, status: 'COMPLETED', revision: 3 })
    ).ok(),
  ).toBeTruthy();
  expect((await detail(buyer, id)).status).toBe('COMPLETED');
  expect((await write(seller, { action: 'quote', requestId: id, revision: 4 })).status()).toBe(409);
});

test('public ADMIN cannot create staff, grant roles, disable staff or change shared passwords', async () => {
  const admin = sessions.admin;
  expect(
    (
      await write(admin, {
        action: 'createUser',
        name: 'Escalation',
        email: 'forbidden@example.test',
        password: randomBytes(24).toString('base64url'),
        role: 'ADMIN',
      })
    ).status(),
  ).toBe(403);
  for (const [key, role] of [
    ['seller-a', 'BUYER'],
    ['buyer-a', 'ADMIN'],
  ])
    expect(
      (
        await write(admin, {
          action: 'user',
          id: credential(key).id,
          name: 'Forbidden',
          phone: '',
          role,
          active: false,
        })
      ).status(),
    ).toBe(403);
  expect(
    (
      await admin.request.post('/api/auth/change-password', {
        headers: { Origin: origin },
        data: {
          currentPassword: credential('admin').password,
          newPassword: randomBytes(24).toString('base64url'),
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await admin.request.post('/api/auth/update-user', {
        headers: { Origin: origin },
        data: { role: 'ADMIN' },
      })
    ).status(),
  ).toBe(404);
  const page = await admin.newPage();
  await page.goto('/ru/admin/users');
  await expect(
    page.getByRole('button', { name: 'Создать пользователя', exact: false }),
  ).toHaveCount(0);
  await expect(page.locator('main')).toContainText('Публичная демонстрация');
  await page.close();
});

test('strict DTOs, Origin, bounded bodies and transaction failure leave no partial request', async () => {
  const buyer = sessions['buyer-a'];
  const before = (await (await read(buyer, 'requests')).json()).requests.length;
  expect(
    (await write(buyer, { action: 'createRequest', lines: [line], note: '', total: 1 })).status(),
  ).toBe(400);
  expect(
    (
      await write(buyer, {
        action: 'createRequest',
        lines: [line, { ...line, variantId: 'missing' }],
        note: '',
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await write(buyer, { action: 'profile', name: 'CSRF', phone: '' }, 'https://attacker.invalid')
    ).status(),
  ).toBe(403);
  expect(
    (
      await write(buyer, { action: 'createRequest', lines: [line], note: 'x'.repeat(110000) })
    ).status(),
  ).toBe(413);
  expect(
    (
      await buyer.request.post('/api/auth/sign-in/email', {
        headers: { Origin: origin },
        data: { email: 'x'.repeat(20000), password: 'invalid' },
      })
    ).status(),
  ).toBe(413);
  expect((await (await read(buyer, 'requests')).json()).requests.length).toBe(before);
});

test('large valid totals round-trip as numbers; old quotes survive catalogue edits', async () => {
  const admin = sessions.admin,
    buyer = sessions['buyer-b'],
    seller = sessions['seller-b'];
  const base = (await (await read(admin, 'products')).json()).products[0] as AdminProduct;
  const data = {
    name: 'Large demo calculation',
    slug: 'large-demo-calculation',
    sku: 'LARGE-DEMO',
    category: base.category,
    image: base.image,
    finish: base.finish,
    material: base.material,
    description: base.description,
    collection: base.collection,
    color: base.color,
    archived: false,
    variants: [
      { width: 800, height: 2100, price: 10000000, stock: 'DEMO_AVAILABLE', active: true },
    ],
  };
  const saved = await write(admin, { action: 'product', data });
  expect(saved.ok()).toBeTruthy();
  const productId = (await saved.json()).id;
  const product = (await (await read(admin, 'products')).json()).products.find(
    (p: AdminProduct) => p.id === productId,
  ) as AdminProduct;
  const lines = Array.from({ length: 30 }, () => ({
    ...line,
    variantId: product.variants[0].id,
    quantity: 20,
    frame: false,
    hardware: false,
  }));
  const created = await write(buyer, { action: 'createRequest', lines, note: '' });
  expect(created.ok()).toBeTruthy();
  const id = (await created.json()).id;
  expect(
    (
      await write(admin, {
        action: 'assign',
        requestId: id,
        sellerId: credential('seller-b').id,
        revision: 1,
      })
    ).ok(),
  ).toBeTruthy();
  const quote = await write(seller, { action: 'quote', requestId: id, revision: 2 });
  expect(quote.ok()).toBeTruthy();
  expect((await quote.json()).total).toBe(6000000000);
  const before = await detail(buyer, id);
  expect(before.quotes[0].total).toBe(6000000000);
  expect(
    (
      await write(admin, {
        action: 'product',
        id: productId,
        data: {
          ...data,
          archived: true,
          variants: [{ ...data.variants[0], id: product.variants[0].id, price: 1 }],
        },
      })
    ).ok(),
  ).toBeTruthy();
  expect((await detail(buyer, id)).quotes).toEqual(before.quotes);
});

test('distributed write limiter stops bursts and isolates other accounts', async () => {
  const buyer = sessions['buyer-a'];
  let limited = false;
  for (let i = 0; i < 45; i++) {
    const response = await write(buyer, {
      action: 'favorite',
      productId: 'd01',
      saved: i % 2 === 0,
    });
    if (response.status() === 429) {
      expect((await response.json()).code).toBe('DEMO_LIMIT');
      limited = true;
      break;
    }
    expect(response.ok()).toBeTruthy();
  }
  expect(limited).toBe(true);
  expect(
    (await write(sessions['buyer-b'], { action: 'favorite', productId: 'd01', saved: true })).ok(),
  ).toBeTruthy();
});
