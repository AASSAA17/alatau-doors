import { test, expect } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off' });
test('Google on mobile: localized button, privacy disclosure and restricted redirect', async ({ page }) => {
  test.skip(!process.env.GOOGLE_CLIENT_ID, 'Optional provider is not configured');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [locale, label] of [['ru', 'Продолжить с Google'], ['kk', 'Google арқылы жалғастыру']]) {
    await page.goto(`/${locale}/sign-up`);
    const button = page.getByRole('button', { name: label });
    await expect(button).toBeVisible();
    await expect(page.locator('.google-sign-in a[href$="/privacy"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
  await page.route('https://accounts.google.com/**', async route => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('redirect_uri')).toBe('https://127.0.0.1:3343/api/auth/callback/google');
    expect(url.searchParams.get('scope')?.split(' ').sort()).toEqual(['email', 'openid', 'profile']);
    await route.fulfill({ contentType: 'text/plain', body: 'OAuth destination intercepted locally' });
  });
  await page.getByRole('button', { name: 'Google арқылы жалғастыру' }).click();
  await expect(page).toHaveURL(/^https:\/\/accounts.google.com\//);
  await page.goto('/ru/sign-in?google=error');
  await expect(page.getByRole('alert')).toContainText('Не удалось войти');
  await page.goto('/kk/privacy');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('құпиялылығы');
});
