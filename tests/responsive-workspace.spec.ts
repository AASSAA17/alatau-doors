import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { readCredentials } from '../scripts/demo-credentials';
import { formatPrice } from '../src/lib/utils';
import type { RequestDetail } from '../src/types/workspace';
const origin = 'http://127.0.0.1:3100';

async function login(context: BrowserContext, key: string) {
  const account=readCredentials(process.env.ALATAU_TEST_CREDENTIALS!).find(c=>c.email===`${key}@alatau.demo`)!;
  const response=await context.request.post('/api/auth/sign-in/email',{headers:{Origin:origin},data:{email:account.email,password:account.password}});
  expect(response.ok()).toBeTruthy();
}
async function fit(page: Page, width: number) {
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}
async function openMenu(page: Page) {
  const button=page.locator('.workspace-menu-toggle');
  if(await button.isVisible()) {await button.click();await expect(button).toHaveAttribute('aria-expanded','true');}
}

for(const locale of ['ru','kk']) test(`${locale}: cabinet sections and mobile record cards remain fully accessible`,async({browser},info)=>{
  const widths=info.project.name==='mobile'?[360,390]:[768,1440];
  for(const [account,root,count] of [['buyer-a','account',4],['seller-a','seller',2],['admin','admin',5]] as const) {
    const context=await browser.newContext({baseURL:origin});
    try {
      await login(context,account);
      const page=await context.newPage();
      for(const width of widths) {
        await page.setViewportSize({width,height:900});
        await page.goto(`/${locale}/${root}`);
        await fit(page,width);
        await openMenu(page);
        const links=page.locator('#workspace-menu a');
        await expect(links).toHaveCount(count);
        const hrefs=await links.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')!));
        for(const href of hrefs) {
          await page.goto(`/${locale}/${root}`);
          await openMenu(page);
          const link=page.locator(`#workspace-menu a[href="${href}"]`);
          await expect(link).toBeVisible();
          const bounds=await link.boundingBox();
          expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width+1);
          await link.click();
          await expect(page).toHaveURL(href);
          await expect(page.locator('main h1')).toBeVisible();
          await expect(page.locator('.workspace-footer')).toBeVisible();
          await expect(page.locator('.footer')).toHaveCount(0);
          await fit(page,width);
        }
        if(account==='admin') {
          await page.goto(`/${locale}/admin/products`);
          const row=page.locator('.product-admin-table tbody tr').first();
          await expect(row).toContainText('Line 01');
          await expect(row).toContainText('AD-DEMO-01');
          if(width<=900) {
            await expect(row).toHaveCSS('display','grid');
            for(const cell of await row.locator('td').all()) {
              await expect(cell).toBeVisible();
              const box=await cell.boundingBox();
              expect(box!.x).toBeGreaterThanOrEqual(0);
              expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
            }
            await row.getByRole('button').click();
            await expect(page.locator('form input[name="name"]')).toHaveValue('Line 01');
          }
        }
        if(account==='buyer-a') {
          const list=await context.request.get('/api/workspace?resource=requests');
          const quoted=(await list.json()).requests.find((r:{status:string})=>r.status==='QUOTED');
          const response=await context.request.get(`/api/workspace?resource=request&id=${quoted.id}`);
          const detail=await response.json() as RequestDetail;
          const line=detail.quotes[0].lines[0];
          await page.goto(`/${locale}/requests/${quoted.id}`);
          const row=page.locator('.quote-table tbody tr').first();
          await expect(row.locator('td').nth(0)).toContainText(`${line.width} × ${line.height}`);
          await expect(row.locator('td').nth(0)).toContainText(line.name);
          await expect(row.locator('td').nth(2)).toHaveText(String(line.quantity));
          await expect(row.locator('td').nth(3)).toHaveText(formatPrice(line.unitPrice,locale));
          await expect(row.locator('td').nth(4)).toHaveText(formatPrice(line.total,locale));
          await fit(page,width);
          if(width<=900) for(const cell of await row.locator('td').all()) {
            const box=await cell.boundingBox();
            expect(box!.x).toBeGreaterThanOrEqual(0);
            expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
          }
        }
      }
    } finally {await context.close();}
  }
});

test('empty contacts use one information panel in both languages',async({page})=>{
  for(const locale of ['ru','kk']) {
    await page.goto(`/${locale}/contacts`);
    await expect(page.locator('.contact-placeholder')).toHaveCount(1);
    await expect(page.locator('.contact-section dl')).toHaveCount(0);
  }
});
