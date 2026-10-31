import { expect, type BrowserContext } from '@playwright/test';
import sharp from 'sharp';
import http from 'node:http';
import https from 'node:https';
export async function checkMedia(admin: BrowserContext, buyer: BrowserContext, seller: BrowserContext, origin: string) {
  const input = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#183f32' } }).jpeg().withMetadata().toBuffer();
  const headers = { Origin: origin, 'Content-Type': 'image/jpeg' };
  expect((await buyer.request.post('/api/media', { headers, data: input })).status()).toBe(403);
  expect((await seller.request.post('/api/media', { headers, data: input })).status()).toBe(403);
  expect((await admin.request.post('/api/media', { headers: { ...headers, Origin: 'https://foreign.invalid' }, data: input })).status()).toBe(403);
  expect((await admin.request.post('/api/media', { headers: { ...headers, 'Content-Type': 'image/svg+xml' }, data: '<svg/>' })).status()).toBe(415);
  expect((await admin.request.post('/api/media', { headers, data: '<script>invalid image</script>' })).status()).toBe(415);
  // An early 413 may legitimately close the upload before its response body is
  // consumed. Assert the HTTP status directly, without requiring keep-alive.
  if (new URL(origin).hostname !== '127.0.0.1') throw new Error('Loopback fixture required');
  const cookies = (await admin.cookies(origin)).map(c => `${c.name}=${c.value}`).join('; ');
  const status = await new Promise<number | undefined>((resolve, reject) => {
    let received = false;
    const request = (origin.startsWith('https:') ? https : http).request(origin + '/api/media', {
      method: 'POST', rejectUnauthorized: false, agent: false,
      headers: { ...headers, Cookie: cookies, 'Content-Length': 4 * 1024 * 1024 + 1 },
    }, response => { received = true; resolve(response.statusCode); response.resume(); request.destroy(); });
    request.on('error', (error: NodeJS.ErrnoException) => { if (!received) reject(new Error('Oversized fixture request failed before HTTP response: ' + (error.code || 'TIMEOUT'))); });
    request.setTimeout(10000, () => request.destroy(new Error('Fixture timeout')));
    request.end(Buffer.alloc(4 * 1024 * 1024 + 1));
  });
  expect(status).toBe(413);
  const uploaded = await admin.request.post('/api/media', { headers, data: input });
  expect(uploaded.status()).toBe(201);
  const result = await uploaded.json();
  expect(result.width).toBe(1800); expect(result.height).toBe(900);
  const image = await buyer.request.get(result.url);
  expect(image.status()).toBe(200); expect(image.headers()['content-type']).toBe('image/webp');
  expect(image.headers()['x-content-type-options']).toBe('nosniff');
  const metadata = await sharp(await image.body()).metadata();
  expect(metadata.exif).toBeUndefined(); expect(metadata.icc).toBeUndefined();
  const optimized = await buyer.request.get('/_next/image?url=' + encodeURIComponent(result.url) + '&w=640&q=75');
  expect(optimized.status()).toBe(200);
  expect((await sharp(await optimized.body()).metadata()).width).toBe(640);
  expect((await buyer.request.get('/api/media/invalid')).status()).toBe(404);
}
