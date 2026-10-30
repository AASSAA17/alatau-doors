import { test, expect } from '@playwright/test';
import { readCredentials } from '../scripts/demo-credentials';
import { checkMedia } from './media-check';
test('product photos enforce roles, origin, decoding limits and strip metadata', async ({ browser }) => {
  const accounts = readCredentials(process.env.ALATAU_TEST_CREDENTIALS!);
  const origin = 'http://127.0.0.1:3100';
  const contexts = [];
  try {
    for (const role of ['ADMIN', 'BUYER', 'SELLER']) {
      const c = await browser.newContext({ baseURL: origin }); contexts.push(c);
      const account = accounts.find(a => a.role === role)!;
      expect((await c.request.post('/api/auth/sign-in/email', { headers: { Origin: origin }, data: { email: account.email, password: account.password } })).ok()).toBeTruthy();
    }
    await checkMedia(contexts[0], contexts[1], contexts[2], origin);
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
