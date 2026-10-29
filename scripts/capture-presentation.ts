import { chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { readCredentials } from './demo-credentials';

const origin = 'http://127.0.0.1:3200';
const databasePath = resolve('.local/presentation-demo.sqlite');
const completion = process.env.CAPTURE_SCOPE === 'completion';
const output = resolve(completion ? 'docs/screenshots/completion' : 'docs/screenshots/presentation');
const sizes = [{width:1440,height:1000},{width:768,height:1024},{width:390,height:844},{width:360,height:800}];
type Capture = { locale: string; width: number; height: number; page: string; viewport: string; full: string; viewportSection: string };

async function prepare(page: Page) {
  for (const img of await page.locator('main img').all()) {
    if (!await img.isVisible()) continue;
    await img.scrollIntoViewIfNeeded();
    await expect(img).not.toHaveJSProperty('naturalWidth',0);
    await img.evaluate((element:HTMLImageElement)=>element.decode());
  }
  await page.evaluate(async()=>{
    await document.fonts.ready;
    window.scrollTo({top:0,behavior:'instant'});
    await new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done())));
  });
}
async function verifyLayout(page: Page, width: number) {
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const menu = page.locator('.workspace-menu-toggle');
  if (width <= 900 && await menu.count()) {
    await menu.click();
    for (const link of await page.locator('#workspace-menu a').all()) {
      await expect(link).toBeVisible();
      const bounds=await link.boundingBox();
      if(!bounds || bounds.x<0 || bounds.x+bounds.width>width+1) throw new Error('Workspace navigation overflows.');
    }
    await menu.click();
  }
  if (width <=900) for (const cell of await page.locator('.responsive-table tbody tr:first-child td').all()) {
    await expect(cell).toBeVisible();
    const bounds=await cell.boundingBox();
    if(!bounds || bounds.x<0 || bounds.x+bounds.width>width+1) throw new Error('A mobile record requires horizontal scrolling.');
  }
}

async function main() {
  if(process.env.APP_MODE!=='demo' || resolve(process.env.DATABASE_PATH||'')!==databasePath) throw new Error('Capture requires the isolated presentation environment.');
  const db = new Database(databasePath,{readonly:true});
  const version=db.prepare("SELECT value FROM app_meta WHERE key='presentationVersion'").get() as {value:string}|undefined;
  const counts={products:(db.prepare('SELECT count(*) AS n FROM products').get() as {n:number}).n, users:(db.prepare('SELECT count(*) AS n FROM user').get() as {n:number}).n, requests:(db.prepare('SELECT count(*) AS n FROM requests').get() as {n:number}).n};
  const polluted=(db.prepare("SELECT count(*) AS n FROM products WHERE json_extract(payload,'$.name') LIKE 'Snapshot%' OR json_extract(payload,'$.name') LIKE 'UI model%'").get() as {n:number}).n;
  db.close();
  if(!version || counts.products!==12 || counts.users!==5 || counts.requests!==5 || polluted) throw new Error('Presentation dataset differs from the clean fixture; capture aborted without changing data.');
  if(await fetch(origin,{signal:AbortSignal.timeout(800)}).then(()=>true,()=>false)) throw new Error('Port 3200 is occupied. Stop the presentation server before capture.');
  const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3200'],{env:process.env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let logs='';
  server.stdout.on('data',data=>{logs=(logs+data.toString()).slice(-6000);});
  server.stderr.on('data',data=>{logs=(logs+data.toString()).slice(-6000);});
  const stop=()=>{server.kill();};
  process.once('SIGINT',stop);
  process.once('SIGTERM',stop);
  const browser=await chromium.launch();
  const captures:Capture[]=[];
  const errors:string[]=[];
  try {
    await expect.poll(async()=>fetch(origin+'/ru',{signal:AbortSignal.timeout(2000)}).then(r=>r.status,()=>0),{timeout:45000}).toBe(200);
    const credentials=readCredentials(process.env.DEMO_CREDENTIALS_PATH!);
    async function signIn(context:BrowserContext,key:string) {
      const account=credentials.find(c=>c.email===key+'@alatau.demo')!;
      const response=await context.request.post('/api/auth/sign-in/email',{headers:{Origin:origin},data:{email:account.email,password:account.password}});
      if(!response.ok()) throw new Error('Presentation sign-in failed.');
    }
    for(const locale of ['ru','kk']) for(const viewport of sizes) {
      const contexts:BrowserContext[]=[];
      const folder=join(output,locale,String(viewport.width));
      mkdirSync(folder,{recursive:true});
      const context=async()=>{const value=await browser.newContext({baseURL:origin,viewport,deviceScaleFactor:1,reducedMotion:'reduce'});contexts.push(value);return value;};
      async function capture(context:BrowserContext,name:string,path:string, setup?: (page:Page)=>Promise<void>) {
        const page=await context.newPage();
        page.on('pageerror',error=>errors.push(error.message));
        page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
        const response=await page.goto(`/${locale}${path}`);
        if(response?.status()!==200) throw new Error(`Capture page failed: ${name}`);
        if(setup) await setup(page);
        await prepare(page);
        await verifyLayout(page,viewport.width);
        await prepare(page);
        if(name==='buyer-quote') {
          await page.locator('.quote-panel').evaluate(element=>element.scrollIntoView({block:'start',behavior:'instant'}));
          await page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));
        }
        if(name==='message-preview') await page.locator('.message-preview').evaluate(element=>element.scrollIntoView({block:'start',behavior:'instant'}));
        await page.screenshot({path:join(folder,`${name}-viewport.png`),animations:'disabled',scale:'css'});
        await page.screenshot({path:join(folder,`${name}-full.png`),fullPage:true,animations:'disabled',scale:'css'});
        captures.push({locale,...viewport,page:name,viewport:`${locale}/${viewport.width}/${name}-viewport.png`,full:`${locale}/${viewport.width}/${name}-full.png`,viewportSection:name==='buyer-quote'?'quote-panel':name==='message-preview'?'message-preview':'page-top'});
        console.log(`Captured ${locale} ${viewport.width}px ${name}`);
        await page.close();
      }
      try {
        const guest=await context();
        if(completion) {
          await capture(guest,'finder-budget','/door-finder?step=3&type=interior&quantity=2&budget=150000');
          await capture(guest,'finder-results','/door-finder?step=4&type=interior&quantity=2&budget=150000');
          await capture(guest,'about','/about');
          await capture(guest,'interior-ideas','/projects');
          await capture(guest,'message-preview','/door-finder?step=4&type=interior&quantity=2&budget=90000',async(page)=>{
            const card=page.getByTestId('finder-result');
            await card.getByRole('combobox').selectOption('d01-900');
            await card.getByRole('button').click();
            await card.locator('a[href$="/selection"]').click();
            await page.getByTestId('request-line').getByRole('checkbox').nth(0).check();
            await page.getByTestId('request-line').getByRole('checkbox').nth(1).check();
            await expect(page.getByTestId('whatsapp-message')).toHaveValue(/238\s000/);
          });
          // Local semantic corrections need one representative capture, not the whole old set.
          if(viewport.width===1440 || viewport.width===390) {
            await capture(guest,'product-specifications','/product/forma-ivory');
            const seller=await context();await signIn(seller,'seller-a');
            await capture(seller,'seller-process','/seller');
          }
          continue;
        }
        await capture(guest,'home','');
        await capture(guest,'catalog','/catalog');
        await capture(guest,'product','/product/forma-ivory');
        const buyer=await context();await signIn(buyer,'buyer-a');
        const list=await buyer.request.get('/api/workspace?resource=requests');
        const request=(await list.json()).requests.find((r:{status:string})=>r.status==='QUOTED');
        if(!request) throw new Error('Presentation quote missing.');
        await capture(buyer,'buyer-quote',`/requests/${request.id}`);
        const admin=await context();await signIn(admin,'admin');
        await capture(admin,'admin-products','/admin/products');
        const seller=await context();await signIn(seller,'seller-a');
        await capture(seller,'seller','/seller');
      } finally {for(const context of contexts) await context.close();}
    }
    if(errors.length) throw new Error('Browser errors: '+errors.join('; '));
    writeFileSync(join(output,'manifest.json'),JSON.stringify({capturedAt:new Date().toISOString(),scope:completion?'completion':'original',source:'.local/presentation-demo.sqlite',dataset:version.value,counts,deviceScaleFactor:1,checks:['No browser errors','No document overflow','Mobile cabinet links visible','Mobile record fields visible without horizontal scrolling'],captures},null,2));
    writeFileSync(join(output,'README.md'),'# Презентационные экраны\n\nИсточник: отдельная presentation-demo.sqlite, набор '+version.value+'. Не используются e2e-базы.\n\nViewport-снимки сохранены 1:1 в CSS-пикселях (deviceScaleFactor=1), без масштабирования. Full — длинная страница. Для buyer-quote видимая область прокручена к расчёту, для message-preview — к предпросмотру текста; остальные viewport-снимки показывают верх страницы.\n\n'+captures.map(c=>`- ${c.locale} / ${c.width}px / ${c.page}: [viewport](${c.viewport}) · [full](${c.full})`).join('\n')+'\n');
    console.log(`Saved ${captures.length*2} clean presentation screenshots. No sessions or passwords were exported.`);
  } catch(error) {
    console.error(logs);
    throw error;
  } finally {
    await browser.close();
    server.kill();
    process.removeListener('SIGINT',stop);
    process.removeListener('SIGTERM',stop);
  }
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Capture failed');process.exitCode=1;});
