import { test, expect, type Page } from '@playwright/test';

async function prepareScreenshot(page: Page) {
  for (const image of await page.locator('main img:visible').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).not.toHaveJSProperty('naturalWidth', 0);
    await image.evaluate((node: HTMLImageElement) => node.decode());
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
}

test('home renders assets, navigation and demo disclosure without overflow', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/ru');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Двери,');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ваш дом лучше');
  await expect(page.locator('.demo-bar')).toContainText('Неофициальная демонстрация');
  await expect(page.locator('.hero-visual img')).toHaveJSProperty('complete', true);
  await expect(page.locator('.hero-visual img')).not.toHaveJSProperty('naturalWidth', 0);
  await expect
    .poll(() => page.evaluate((width) => document.documentElement.scrollWidth <= width, page.viewportSize()!.width))
    .toBe(true);
  await prepareScreenshot(page);
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
  await page.screenshot({ path: testInfo.outputPath('home-viewport.png') });
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Открыть меню' }).click();
    await expect(page.locator('#mobile-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-menu')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Открыть меню' })).toBeFocused();
  }
  await page.getByRole('link', { name: 'Перейти в каталог' }).click();
  await expect(page).toHaveURL(/\/ru\/catalog$/);
  expect(errors).toEqual([]);
});

test('search, budget, sort, empty state and URL reload', async ({ page }) => {
  await page.goto('/ru/catalog');
  await expect(page.getByTestId('product-card')).toHaveCount(12);
  await page.getByRole('searchbox', { name: 'Поиск по каталогу' }).fill('AD-DEMO-01');
  await page.getByRole('button', { name: 'Найти', exact: true }).click();
  await expect(page.getByTestId('product-card')).toHaveCount(1);
  await expect(page.getByTestId('product-card')).toContainText('Line 01');
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue('AD-DEMO-01');
  await page.getByRole('link', { name: 'Сбросить фильтры' }).click();
  await expect(page).toHaveURL('/ru/catalog');
  await expect(page.getByTestId('product-card')).toHaveCount(12);
  if (await page.locator('.mobile-filter-toggle').isVisible()) await page.locator('.mobile-filter-toggle').click();
  await page.getByLabel('Бюджет за полотно').selectOption('150000');
  await expect(page.getByTestId('product-card')).toHaveCount(7);
  await page.getByLabel('Сортировка').selectOption('price-desc');
  await expect(page.getByTestId('product-card').first()).toContainText('Studio 04');
  await page.getByRole('searchbox').fill('нет-такой-двери');
  await page.getByRole('button', { name: 'Найти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Таких дверей пока нет' })).toBeVisible();
  await page.locator('.empty-state').getByRole('link', { name: 'Сбросить фильтры' }).click();
  await expect(page.getByTestId('product-card')).toHaveCount(12);
});

test('product configuration, persisted favorites and removal', async ({ page }, testInfo) => {
  await page.goto('/ru/product/line-oak');
  await page.getByRole('radio', { name: '900' }).check();
  await page.getByRole('button', { name: 'Увеличить количество' }).click();
  await expect(page.getByTestId('subtotal')).toContainText(/178\s*000/);
  await expect(page.locator('.subtotal small')).toContainText('900 × 2100');
  await page.locator('.product-options').getByRole('button', {name:'В избранное',exact:true}).click();
  await expect(page.getByRole('button',{name:'Сохранено в избранном'})).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button',{name:'Сохранено в избранном'})).toHaveAttribute('aria-pressed', 'true');
  await prepareScreenshot(page);
  await page.screenshot({ path: testInfo.outputPath('product.png'), fullPage: true });
  await page.locator('.header-actions').getByRole('link', { name: 'Избранное (1)' }).click();
  await expect(page.getByTestId('product-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Убрать из избранного' }).click();
  await expect(page.getByRole('heading', { name: 'Здесь будет ваш выбор' })).toBeVisible();
});

test('locale switch preserves product and catalog query', async ({ page }) => {
  await page.goto('/ru/product/forma-ivory');
  await page.getByRole('link', { name: 'ҚАЗ', exact: true }).click();
  await expect(page).toHaveURL('/kk/product/forma-ivory');
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await expect(page.locator('.detail-finish')).toContainText('Жылы ақ');
  await page.goto('/ru/catalog?sort=price-asc&maxPrice=150000');
  await page.getByRole('link', { name: 'ҚАЗ', exact: true }).click();
  await expect(page).toHaveURL(/\/kk\/catalog\?.*maxPrice=150000/);
  await expect(page.getByTestId('product-card')).toHaveCount(7);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Есіктер каталогы');
});

test('guest selection restores a configured product after navigation and reload', async ({page}) => {
  await page.goto('/ru/product/line-oak');
  await page.getByRole('radio',{name:'900',exact:true}).check();
  await page.getByRole('button',{name:'Увеличить количество'}).click();
  await page.getByRole('button',{name:'Добавить в подборку',exact:true}).click();
  await page.locator('.product-options').getByRole('link').click();
  await expect(page).toHaveURL('/ru/selection');
  await expect(page.getByTestId('request-line')).toHaveCount(1);
  await expect(page.getByTestId('request-line').getByLabel('Количество',{exact:true})).toHaveValue('2');
  await page.reload();
  await expect(page.getByTestId('request-line').getByRole('combobox')).toHaveValue('d01-900');
});

test('categories, missing model and noindex', async ({ page }) => {
  await page.goto('/ru/catalog/entrance');
  await expect(page.getByTestId('product-card')).toHaveCount(3);
  await expect(page.getByTestId('product-card').first()).toContainText('Terra 03');
  await page.goto('/ru/catalog/interior');
  await expect(page.getByTestId('product-card')).toHaveCount(9);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.goto('/ru/product/nonexistent');
  await expect(page.getByRole('heading', { name: 'Эта дверь пока закрыта' })).toBeVisible();
});

test('catalog images load and narrow layouts do not overflow', async ({ page }, testInfo) => {
  await page.goto('/ru/catalog');
  for (const width of testInfo.project.name === 'mobile' ? [360, 390, 768] : [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate((width) => document.documentElement.scrollWidth <= width, page.viewportSize()!.width))
      .toBe(true);
  }
  for (const image of await page.locator('.product-image').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).not.toHaveJSProperty('naturalWidth', 0);
  }
  await page.screenshot({ path: testInfo.outputPath('catalog.png'), fullPage: true });
});
