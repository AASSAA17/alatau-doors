import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import type { Role } from '../src/types/workspace';

export type DemoCredential = { id: string; role: Role; name: string; email: string; password: string };
type Envelope = { version: 1; salt: string; iv: string; tag: string; ciphertext: string };
function key(salt: Buffer) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('BETTER_AUTH_SECRET is required for local demo credentials.');
  return Buffer.from(hkdfSync('sha256', secret, salt, 'alatau-demo-credentials-v1', 32));
}
export function writeCredentials(path: string, credentials: DemoCredential[]) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(salt), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()]);
  const data: Envelope = { version: 1, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
  writeFileSync(path, JSON.stringify(data, null, 2), { mode: 0o600 });
}
export function readCredentials(path: string): DemoCredential[] {
  const data = JSON.parse(readFileSync(path, 'utf8')) as Envelope;
  if (data.version !== 1) throw new Error('Unsupported demo credential file.');
  const decipher = createDecipheriv('aes-256-gcm', key(Buffer.from(data.salt, 'base64')), Buffer.from(data.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(data.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data.ciphertext, 'base64')), decipher.final()]).toString('utf8'));
}
