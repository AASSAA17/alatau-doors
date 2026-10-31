import {test,expect} from '@playwright/test';
import {randomBytes} from 'node:crypto';

test('finder keeps answers, filters category and per-leaf budget, exposes empty state and resets',async({page})=>{
  await page.goto('/ru/door-finder');
  await page.getByRole('radio',{name:/Входная/}).check();
  await page.getByRole('button',{name:'Далее →'}).click();
  await page.getByRole('spinbutton',{name:/^Количество дверей/}).fill('3');
  await page.getByRole('button',{name:'Далее →'}).click();
  await page.getByLabel('Пока не определился').uncheck();
  await page.getByLabel('Максимум за одно полотно, ₸').fill('250000');
  await page.getByRole('button',{name:'Назад',exact:true}).click();
  await expect(page.getByRole('spinbutton',{name:/^Количество дверей/})).toHaveValue('3');
  await page.getByRole('button',{name:'Далее →'}).click();
  await expect(page.getByLabel('Максимум за одно полотно, ₸')).toHaveValue('250000');
  await page.getByRole('button',{name:'Показать модели →'}).click();
  await expect(page.getByTestId('finder-result')).toHaveCount(1);
  await expect(page.getByTestId('finder-result')).toContainText('Terra 03');
  await expect(page.getByTestId('finder-result')).toHaveAttribute('data-category','entrance');
  await page.reload();
  await expect(page.getByTestId('finder-summary')).toContainText('3 шт.');
  await page.getByRole('button',{name:'Назад',exact:true}).click();
  await page.getByLabel('Максимум за одно полотно, ₸').fill('1000');
  await page.getByRole('button',{name:'Показать модели →'}).click();
  await expect(page.getByRole('heading',{name:'Подходящих моделей нет'})).toBeVisible();
  await expect(page.getByTestId('finder-result')).toHaveCount(0);
  await page.getByRole('button',{name:'Изменить бюджет'}).click();
  await page.getByLabel('Пока не определился').check();
  await page.getByRole('button',{name:'Показать модели →'}).click();
  await expect(page.getByTestId('finder-result')).toHaveCount(3);
  await page.getByRole('link',{name:'Сбросить ответы'}).click();
  await expect(page).toHaveURL('/ru/door-finder');
  await expect(page.getByRole('radio',{name:/Межкомнатная/})).toBeChecked();
});

test('finder variant and quantity reach existing selection; preview and clipboard never send',async({page,context})=>{
  await page.goto('/ru/door-finder?step=4&type=interior&quantity=2&budget=90000');
  const card=page.getByTestId('finder-result');await expect(card).toHaveCount(1);
  await card.getByRole('combobox').selectOption('d01-900');
  await card.getByRole('button',{name:'Добавить в подборку',exact:true}).click();
  await card.getByRole('link',{name:'Моя подборка'}).click();
  await expect(page.getByTestId('request-line').getByRole('combobox')).toHaveValue('d01-900');
  await expect(page.getByTestId('request-line').getByLabel('Количество',{exact:true})).toHaveValue('2');
  await page.getByTestId('request-line').getByRole('checkbox').nth(0).check();
  await page.getByTestId('request-line').getByRole('checkbox').nth(1).check();
  const preview=page.getByTestId('whatsapp-message');
  await expect(preview).toHaveValue(/Line 01 · 900 × 2100 мм/);
  await expect(preview).toHaveValue(/Количество: 2/);
  await expect(preview).toHaveValue(/238\s000/);
  await expect(page.locator('.selection-total')).toContainText(/238\s000/);
  await expect(preview).not.toHaveValue(/@alatau|password|seller-a|Внутренний/i);
  const sent:string[]=[];context.on('request',request=>{if(request.method()!=='GET'||!request.url().startsWith('http://127.0.0.1:3100'))sent.push(request.url());});
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.getByRole('button',{name:'Скопировать текст'}).click();
  await expect(page.getByRole('status')).toContainText('Текст скопирован. Ничего не отправлено.');
  expect((await page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n')).toBe(await preview.inputValue());
  expect(context.pages()).toHaveLength(1);expect(sent).toEqual([]);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('Denied'))},configurable:true}));
  await page.getByRole('button',{name:'Скопировать текст'}).click();
  await expect(page.getByRole('status')).toContainText('Выделите текст');
  await expect(preview).toHaveValue(/238\s000/);
});

test('authentication returns to selection; explicit guest import persists before guest copy is removed',async({page})=>{
  await page.goto('/ru/door-finder?step=4&type=interior&quantity=2&budget=90000');
  const card=page.getByTestId('finder-result');await card.getByRole('combobox').selectOption('d01-800');
  await card.getByRole('button',{name:'Добавить в подборку',exact:true}).click();await card.getByRole('link',{name:'Моя подборка'}).click();
  await page.locator('a[href="/ru/sign-in?returnTo=selection"]').click();
  await page.locator('a[href="/ru/sign-up?returnTo=selection"]').click();
  await page.getByLabel('Имя',{exact:true}).fill('Finder Demo Buyer');
  await page.locator('[name="phone"]').fill('+7 (700) 123-45-67');
  await page.getByLabel('Email',{exact:true}).fill(`finder-${Date.now()}@alatau.demo`);
  await page.getByLabel('Пароль',{exact:true}).fill(randomBytes(24).toString('base64url'));
  await page.locator('form').getByRole('button').click();
  await expect(page).toHaveURL('/ru/selection');
  await page.getByRole('button',{name:'Добавить гостевые позиции в эту подборку'}).click();
  await expect(page.getByTestId('request-line').getByRole('combobox')).toHaveValue('d01-800');
  await page.reload();
  await expect(page.getByTestId('request-line').getByLabel('Количество',{exact:true})).toHaveValue('2');
  expect(await page.evaluate(()=>localStorage.getItem('alatau-guest-draft-v1'))).toBeNull();
});

test('new localized pages reload, switch locale and fit all target widths',async({page},info)=>{
  for(const width of info.project.name==='mobile'?[360,390]:[768,1440]){
    await page.setViewportSize({width,height:900});
    for(const route of ['door-finder','about','projects'])for(const locale of ['ru','kk']){
      await page.goto(`/${locale}/${route}`);await page.reload();
      await expect(page.locator('main h1')).toBeVisible();
      await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.getByRole('link',{name:locale==='ru'?'ҚАЗ':'RU',exact:true}).click();
      await expect(page).toHaveURL(`/${locale==='ru'?'kk':'ru'}/${route}`);
      if(route==='projects')await expect(page.locator('.interior-idea figcaption')).toHaveCount(3);
    }
  }
  await page.goto('/ru/about');await page.locator('main').getByRole('link',{name:'Подобрать двери →'}).click();
  await expect(page).toHaveURL('/ru/door-finder');
  await page.goto('/ru/selection');await expect(page.locator('.message-preview')).toContainText('Подборка пуста');
});

test('Forma coating is distinct from unspecified core and color',async({page})=>{
  await page.goto('/ru/product/forma-ivory');
  const dl=page.locator('.specifications dl');
  await expect(dl.locator('div').filter({has:page.locator('dt',{hasText:'Материал полотна'})})).toContainText('Не указан');
  await expect(dl.locator('div').filter({has:page.locator('dt',{hasText:'Покрытие'})})).toContainText('Эмаль');
  await expect(dl.locator('div').filter({has:page.locator('dt',{hasText:'Цвет / оттенок'})})).toContainText('Тёплый белый');
});
