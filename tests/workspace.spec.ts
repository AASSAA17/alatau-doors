import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { readCredentials } from '../scripts/demo-credentials';
import { clearTestAuthRates } from './auth-rate-fixture';
test.beforeEach(clearTestAuthRates);
import type { AdminProduct, LineInput, RequestDetail } from '../src/types/workspace';
const origin = 'http://127.0.0.1:3100';
type Credential = {
    id: string;
    email: string;
    password: string;
    name: string;
    role: string;
};
function credential(key: string): Credential { return readCredentials(process.env.ALATAU_TEST_CREDENTIALS!).find((c) => c.email === `${key}@alatau.demo`)!; }
async function login(context: BrowserContext, key: string) { const c = credential(key); const r = await context.request.post('/api/auth/sign-in/email', { data: { email: c.email, password: c.password }, headers: { Origin: origin } }); expect(r.ok()).toBeTruthy(); }
async function signed(browser: Browser, key: string) { const context = await browser.newContext({ baseURL: origin }); await login(context, key); return context; }
async function write(context: BrowserContext, data: unknown) { return context.request.post('/api/workspace', { data, headers: { Origin: origin } }); }
async function read(context: BrowserContext, resource: string, id?: string) { return context.request.get(`/api/workspace?resource=${resource}${id ? '&id=' + id : ''}`); }
const line: LineInput = { variantId: 'd01-700', quantity: 2, frame: true, hardware: true, installation: false };
async function create(context: BrowserContext) { const r = await write(context, { action: 'createRequest', lines: [line], note: 'E2E demo request' }); expect(r.ok()).toBeTruthy(); return (await r.json()).id as string; }
async function detail(context: BrowserContext, id: string): Promise<RequestDetail> { const r = await read(context, 'request', id); expect(r.ok()).toBeTruthy(); return r.json(); }
async function signInUI(page: Page, key: string, locale = 'ru') { const c = credential(key); await page.goto(`/${locale}/sign-in`); await page.getByLabel('Email', { exact: true }).fill(c.email); await page.getByLabel(locale === 'ru' ? 'Пароль' : 'Құпиясөз', { exact: true }).fill(c.password); await page.locator('form').getByRole('button', { name: locale === 'ru' ? 'Войти' : 'Кіру', exact: true }).click(); await expect(page).toHaveURL(new RegExp(`/${locale}/(account|seller|admin)$`)); }
test('buyer A cannot read or mutate buyer B, including a direct page', async ({ browser }) => {
    const a = await signed(browser, 'buyer-a');
    const b = await signed(browser, 'buyer-b');
    try {
        const id = await create(b);
        expect((await read(a, 'request', id)).status()).toBe(404);
        const list = await (await read(a, 'requests')).json();
        expect(list.requests.some((r: {
            id: string;
        }) => r.id === id)).toBe(false);
        expect((await write(a, { action: 'status', requestId: id, status: 'CANCELLED', revision: 1 })).status()).toBe(404);
        const page = await a.newPage();
        await page.goto(`/ru/requests/${id}`);
        await expect(page.getByRole('heading', { name: 'Эта дверь пока закрыта' })).toBeVisible();
        await expect(page.locator('body')).not.toContainText('E2E demo request');
    }
    finally {
        await a.close();
        await b.close();
    }
});
test('seller A cannot access seller B, alter price/users/settings, or assign self', async ({ browser }) => {
    const buyer = await signed(browser, 'buyer-a');
    const admin = await signed(browser, 'admin');
    const a = await signed(browser, 'seller-a');
    const b = await signed(browser, 'seller-b');
    try {
        const id = await create(buyer);
        expect((await write(admin, { action: 'assign', requestId: id, sellerId: credential('seller-b').id, revision: 1 })).ok()).toBeTruthy();
        const d = await detail(b, id);
        expect((await read(a, 'request', id)).status()).toBe(404);
        expect((await write(a, { action: 'quote', requestId: id, revision: d.revision })).status()).toBe(404);
        expect((await write(a, { action: 'comment', requestId: id, text: 'blocked' })).status()).toBe(404);
        expect((await write(a, { action: 'items', requestId: id, lines: [line], revision: d.revision })).status()).toBe(404);
        expect((await write(a, { action: 'assign', requestId: id, sellerId: credential('seller-a').id, revision: d.revision })).status()).toBe(403);
        for (const resource of ['users', 'products', 'settings'])
            expect((await read(a, resource)).status()).toBe(403);
        expect((await write(a, { action: 'user', id: credential('buyer-a').id, name: 'Forbidden', phone: '', role: 'ADMIN', active: true })).status()).toBe(403);
        const settings = await (await read(admin, 'settings')).json();
        expect((await write(a, { action: 'settings', data: settings })).status()).toBe(403);
        const page = await a.newPage();
        await page.goto(`/ru/requests/${id}`);
        await expect(page.getByRole('heading', { name: 'Эта дверь пока закрыта' })).toBeVisible();
        await page.goto('/ru/admin/users');
        await expect(page.getByRole('heading', { name: 'Эта дверь пока закрыта' })).toBeVisible();
    }
    finally {
        for (const c of [buyer, admin, a, b])
            await c.close();
    }
});
test('registration cannot elevate role and client totals and identities are rejected', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: origin });
    try {
        const email = `buyer-${crypto.randomUUID()}@example.test`;
        const password = 'Test-' + crypto.randomUUID();
        const forged = await context.request.post('/api/auth/sign-up/email', { data: { name: 'E2E Buyer', email, password, role: 'ADMIN', active: true }, headers: { Origin: origin } });
        expect(forged.status()).toBe(400);
        const valid = await context.request.post('/api/auth/sign-up/email', { data: { name: 'E2E Buyer', email, password }, headers: { Origin: origin } });
        expect(valid.ok()).toBeTruthy();
        const me = await (await read(context, 'me')).json();
        expect(me.actor.role).toBe('BUYER');
        expect((await read(context, 'users')).status()).toBe(403);
        for (const extra of [{ buyerId: credential('buyer-b').id }, { sellerId: credential('seller-a').id }, { total: 1 }, { role: 'ADMIN' }])
            expect((await write(context, { action: 'createRequest', lines: [line], note: 'x', ...extra })).status()).toBe(400);
        expect((await write(context, { action: 'createRequest', lines: [{ ...line, unitPrice: 1 }], note: '' })).status()).toBe(400);
        expect((await context.request.post('/api/workspace', { data: { action: 'profile', name: 'CSRF', phone: '' }, headers: { Origin: 'https://attacker.invalid' } })).status()).toBe(403);
        expect((await context.request.post('/api/auth/update-user', { data: { role: 'ADMIN' }, headers: { Origin: origin } })).status()).toBe(404);
    }
    finally {
        await context.close();
    }
});
test('profile, account favorites and draft survive logout and a separate session', async ({ browser }) => {
    const a = await signed(browser, 'buyer-a');
    const name = `Buyer A ${crypto.randomUUID().slice(0, 6)}`;
    try {
        expect((await write(a, { action: 'profile', name, phone: '+7 700 000 00 01' })).ok()).toBeTruthy();
        expect((await write(a, { action: 'favorite', productId: 'd02', saved: true })).ok()).toBeTruthy();
        expect((await write(a, { action: 'draft', lines: [line] })).ok()).toBeTruthy();
        await a.request.post('/api/auth/sign-out', { headers: { Origin: origin }, data: {} });
    }
    finally {
        await a.close();
    }
    const restored = await signed(browser, 'buyer-a');
    const other = await signed(browser, 'buyer-b');
    try {
        expect((await (await read(restored, 'me')).json()).actor.name).toBe(name);
        expect((await (await read(restored, 'favorites')).json()).ids).toContain('d02');
        expect((await (await read(restored, 'draft')).json()).lines).toEqual([line]);
        expect((await (await read(other, 'favorites')).json()).ids).not.toContain('d02');
        const page = await restored.newPage();
        await page.goto('/ru/favorites');
        await expect(page.getByTestId('product-card').filter({ hasText: 'Forma 02' })).toBeVisible();
        await page.reload();
        await expect(page.getByTestId('product-card').filter({ hasText: 'Forma 02' })).toBeVisible();
    }
    finally {
        await restored.close();
        await other.close();
    }
});
test('quote snapshots survive changed prices, archived products and preserve private comments', async ({ browser }) => {
    const admin = await signed(browser, 'admin');
    const buyer = await signed(browser, 'buyer-b');
    const seller = await signed(browser, 'seller-b');
    try {
        const base = (await (await read(admin, 'products')).json()).products[0] as AdminProduct;
        const data = { name: 'Snapshot ' + crypto.randomUUID().slice(0, 8), slug: 'snapshot-' + crypto.randomUUID(), sku: 'S-' + crypto.randomUUID(), category: base.category, image: base.image, finish: base.finish, material: base.material, description: base.description, collection: base.collection, color: base.color, archived: false, variants: [{ width: 800, height: 2100, price: 100000, stock: 'DEMO_AVAILABLE', active: true }] };
        const saved = await (await write(admin, { action: 'product', data })).json();
        const product = (await (await read(admin, 'products')).json()).products.find((p: AdminProduct) => p.id === saved.id) as AdminProduct;
        const v = product.variants[0];
        const newLine = { ...line, variantId: v.id };
        const request = await (await write(buyer, { action: 'createRequest', lines: [newLine], note: '' })).json();
        const id = request.id;
        await write(admin, { action: 'assign', requestId: id, sellerId: credential('seller-b').id, revision: 1 });
        const d = await detail(seller, id);
        await write(seller, { action: 'comment', requestId: id, text: 'PRIVATE_SENTINEL' });
        expect((await write(seller, { action: 'quote', requestId: id, revision: d.revision })).ok()).toBeTruthy();
        const before = await detail(buyer, id);
        expect(before).not.toHaveProperty('comments');
        expect(JSON.stringify(before)).not.toContain('PRIVATE_SENTINEL');
        expect(before.quotes[0].total).toBe(260000);
        expect((await write(admin, { action: 'product', id: product.id, data: { ...data, archived: true, variants: [{ ...data.variants[0], id: v.id, price: 999999 }] } })).ok()).toBeTruthy();
        const after = await detail(buyer, id);
        expect(after.quotes).toEqual(before.quotes);
        expect(after.status).toBe('QUOTED');
        const page = await buyer.newPage();
        await page.goto(`/ru/requests/${id}`);
        await expect(page.locator('body')).not.toContainText('PRIVATE_SENTINEL');
        await expect(page.getByRole('heading', { name: 'Внутренние комментарии' })).toHaveCount(0);
        await expect(page.getByTestId('saved-quote-total').first()).toContainText(/260\s*000/);
    }
    finally {
        for (const c of [admin, buyer, seller])
            await c.close();
    }
});
test('three workspaces complete the real buyer → admin → seller → buyer flow', async ({ browser }, testInfo) => {
    const viewport = testInfo.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 };
    const buyer = await browser.newContext({ baseURL: origin, viewport });
    const admin = await browser.newContext({ baseURL: origin, viewport });
    const seller = await browser.newContext({ baseURL: origin, viewport });
    try {
        const bp = await buyer.newPage();
        await signInUI(bp, 'buyer-b');
        await bp.getByRole('link', { name: 'Новая заявка', exact: false }).click();
        await bp.getByRole('button', { name: 'Добавить дверь', exact: false }).click();
        await bp.getByTestId('request-line').first().getByLabel('Количество', { exact: true }).fill('2');
        await bp.getByTestId('request-line').first().getByLabel('Короб и наличники', { exact: false }).check();
        await bp.getByLabel('Комментарий покупателя').fill('UI workflow ' + testInfo.project.name);
        await bp.getByRole('button', { name: 'Создать заявку', exact: true }).click();
        await expect(bp).toHaveURL(/\/requests\//);
        const id = new URL(bp.url()).pathname.split('/').pop()!;
        const ap = await admin.newPage();
        await signInUI(ap, 'admin');
        await ap.goto(`/ru/requests/${id}`);
        await ap.getByLabel('Продавец', { exact: false }).selectOption(credential('seller-a').id);
        await ap.getByRole('button', { name: 'Назначить продавца', exact: true }).click();
        await expect(ap.locator('.workspace-heading .status-badge')).toHaveText('В работе');
        await ap.screenshot({ path: testInfo.outputPath('admin-request.png'), fullPage: true });
        const sp = await seller.newPage();
        await signInUI(sp, 'seller-a');
        await sp.goto(`/ru/requests/${id}`);
        await sp.getByLabel('Комментарий сотрудника').fill('Internal UI note');
        await sp.getByRole('button', { name: 'Добавить комментарий', exact: true }).click();
        await expect(sp.locator('.internal-comments article')).toContainText('Internal UI note');
        await sp.getByTestId('request-line').first().getByLabel('Количество', { exact: true }).fill('3');
        await sp.getByRole('button', { name: 'Сохранить состав', exact: true }).click();
        await expect(sp.getByRole('button', { name: 'Подготовить расчёт', exact: true })).toBeEnabled();
        await sp.getByRole('button', { name: 'Подготовить расчёт', exact: true }).click();
        await expect(sp.locator('.workspace-heading .status-badge')).toHaveText('Расчёт готов');
        await sp.screenshot({ path: testInfo.outputPath('seller-quote.png'), fullPage: true });
        await bp.reload();
        await expect(bp.locator('.workspace-heading .status-badge')).toHaveText('Расчёт готов');
        await expect(bp.getByTestId('saved-quote-total')).toContainText(/321\s*000/);
        await expect(bp.locator('body')).not.toContainText('Internal UI note');
        await bp.screenshot({ path: testInfo.outputPath('buyer-quote.png'), fullPage: true });
        await sp.getByRole('button', { name: 'Завершить заявку', exact: true }).click();
        await expect(sp.locator('.workspace-heading .status-badge')).toHaveText('Завершена');
        await bp.reload();
        await expect(bp.locator('.workspace-heading .status-badge')).toHaveText('Завершена');
        await expect.poll(() => bp.evaluate((width) => document.documentElement.scrollWidth <= width, bp.viewportSize()!.width)).toBe(true);
    }
    finally {
        for (const c of [buyer, admin, seller])
            await c.close();
    }
});
test('Kazakh login, selection, cabinet and role links work', async ({ page }, testInfo) => {
    await signInUI(page, 'buyer-a', 'kk');
    await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
    await expect(page.getByRole('heading', { name: 'Өтінімдер', exact: true })).toBeVisible();
    await page.goto('/kk/selection');
    await expect(page.getByRole('heading', { name: 'Менің таңдауым' })).toBeVisible();
    await page.goto('/kk/account/profile');
    await expect(page.getByRole('heading', { name: 'Менің профилім' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Сақтау', exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate((width) => document.documentElement.scrollWidth <= width, page.viewportSize()!.width)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('profile-kk.png'), fullPage: true });
});
test('admin forms persist products, variants, users and bilingual contacts', async ({ page }, testInfo) => {
    await signInUI(page, 'admin');
    const suffix = crypto.randomUUID().slice(0, 8);
    const model = `UI model ${suffix}`;
    await page.goto('/ru/admin/products');
    await page.getByRole('button', { name: 'Новый товар', exact: false }).click();
    const form = page.locator('form.workspace-form');
    for (const [key, value] of Object.entries({ name: model, slug: `ui-${suffix}`, sku: `UI-${suffix}`, collection: 'Test', 'finish.ru': 'Тестовая отделка', 'finish.kk': 'Сынақ әрлеуі', 'material.ru': 'Демо материал', 'material.kk': 'Демо материал', 'description.ru': 'Тестовый товар, не предложение магазина.', 'description.kk': 'Сынақ тауары, дүкеннің ұсынысы емес.' })) {
        await form.locator(`[name="${key}"]`).fill(value);
    }
    await form.locator('input[type=file]').setInputFiles('public/images/ivory.webp');
    await expect(form.locator('select[name=image]')).toHaveValue(/\/api\/media\//);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('admin-photo-upload.png'), fullPage: true });
    await form.getByLabel('Цена полотна, ₸').fill('123456');
    await form.getByLabel('Архивировать товар').check();
    await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
    let row = page.getByRole('row').filter({ hasText: model });
    await expect(row).toContainText(/123\s*456/);
    await row.getByRole('button', { name: 'Редактировать', exact: true }).click();
    await expect(form.locator('select[name=image]')).toHaveValue(/\/api\/media\//);
    await form.getByLabel('Цена полотна, ₸').fill('135790');
    await form.getByLabel('Вариант активен').uncheck();
    await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(form).toHaveCount(0);
    await page.reload();
    row = page.getByRole('row').filter({ hasText: model });
    await expect(row).toContainText(/135\s*790/);
    await expect(row).toContainText('В архиве');
    await expect.poll(() => page.evaluate((width) => document.documentElement.scrollWidth <= width, page.viewportSize()!.width)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('admin-products.png'), fullPage: true });
    await page.goto('/ru/admin/users');
    await page.getByRole('button', { name: 'Создать пользователя', exact: false }).click();
    const email = `ui-${suffix}@example.test`;
    await form.locator('[name="name"]').fill(`UI employee ${suffix}`);
    await form.locator('[name="email"]').fill(email);
    await form.locator('[name="password"]').fill('Test-' + crypto.randomUUID());
    await form.locator('[name="role"]').selectOption('SELLER');
    await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
    const userRow = page.getByRole('row').filter({ hasText: email });
    await expect(userRow).toContainText('Продавец');
    await userRow.getByRole('button', { name: 'Редактировать', exact: true }).click();
    await form.locator('[name="active"]').uncheck();
    await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(userRow).toContainText('Заблокирован');
    await page.goto('/ru/admin/settings');
    await form.locator('[name="addressRu"]').fill('Тестовый адрес, не магазин');
    await form.locator('[name="addressKk"]').fill('Сынақ мекенжайы, дүкен емес');
    await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.locator('.form-success')).toBeVisible();
    await page.goto('/ru/contacts');
    await expect(page.locator('main')).toContainText('Тестовый адрес, не магазин');
    await page.goto('/kk/contacts');
    await expect(page.locator('main')).toContainText('Сынақ мекенжайы, дүкен емес');
    await page.goto('/ru/admin/settings');
    await form.locator('[name="addressRu"]').fill('');
    await form.locator('[name="addressKk"]').fill('');
    await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.locator('.form-success')).toBeVisible();
});
test('terminal transitions, stale writes, role revocation and disabled account are enforced', async ({ browser }) => {
    const admin = await signed(browser, 'admin');
    const buyer = await signed(browser, 'buyer-b');
    const seller = await signed(browser, 'seller-a');
    try {
        const id = await create(buyer);
        await write(admin, { action: 'assign', requestId: id, sellerId: credential('seller-a').id, revision: 1 });
        expect((await write(seller, { action: 'items', requestId: id, lines: [line], revision: 1 })).status()).toBe(409);
        expect((await write(seller, { action: 'status', requestId: id, status: 'COMPLETED', revision: 2 })).status()).toBe(409);
        expect((await write(buyer, { action: 'status', requestId: id, status: 'IN_PROGRESS', revision: 2 })).status()).toBe(403);
        await write(buyer, { action: 'status', requestId: id, status: 'CANCELLED', revision: 2 });
        expect((await write(seller, { action: 'quote', requestId: id, revision: 3 })).status()).toBe(409);
        const email = `employee-${crypto.randomUUID()}@example.test`;
        const password = 'Test-' + crypto.randomUUID();
        const made = await write(admin, { action: 'createUser', name: 'E2E employee', email, password, role: 'SELLER' });
        expect(made.ok()).toBeTruthy();
        const uid = (await made.json()).id;
        const employee = await browser.newContext({ baseURL: origin });
        try {
            expect((await employee.request.post('/api/auth/sign-in/email', { data: { email, password }, headers: { Origin: origin } })).ok()).toBeTruthy();
            await write(admin, { action: 'user', id: uid, name: 'E2E employee', phone: '', role: 'BUYER', active: true });
            expect((await read(employee, 'requests')).status()).toBe(401);
            await write(admin, { action: 'user', id: uid, name: 'E2E employee', phone: '', role: 'BUYER', active: false });
            expect((await employee.request.post('/api/auth/sign-in/email', { data: { email, password }, headers: { Origin: origin } })).ok()).toBe(false);
        }
        finally {
            await employee.close();
        }
        expect((await write(admin, { action: 'user', id: credential('admin').id, name: 'Admin', phone: '', role: 'BUYER', active: true })).status()).toBe(400);
    }
    finally {
        for (const c of [admin, buyer, seller])
            await c.close();
    }
});
