// Server-only provider adapters. No test transport or delivery secrets are exposed to clients.
import { AsyncLocalStorage } from 'node:async_hooks';
export const deliveryContext = new AsyncLocalStorage<{ failed: boolean }>();
export function markDeliveryFailure() { const state = deliveryContext.getStore(); if (state) state.failed = true; }
export function emailLoginReady() {
  return process.env.AUTH_MAIL_PROVIDER === 'resend' && Boolean(process.env.RESEND_API_KEY && process.env.AUTH_MAIL_FROM);
}
export function smsLoginReady() {
  return process.env.AUTH_SMS_PROVIDER === 'twilio-verify' && process.env.AUTH_SMS_ENABLED === 'true' &&
    Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID);
}
export async function deliverLoginEmail(email: string, value: string, kind: 'code' | 'link', locale = 'ru') {
  if (!emailLoginReady()) throw new Error('DELIVERY_UNAVAILABLE');
  const kk = locale === 'kk';
  const subject = kk ? 'Alatau Doors — кіру' : 'Alatau Doors — вход';
  const text = (kind === 'code'
    ? (kk ? 'Кіру коды (5 минут): ' : 'Код входа (5 минут): ')
    : (kk ? 'Кіру сілтемесі (10 минут): ' : 'Ссылка для входа (10 минут): ')) + value + '\n\n' +
    (kk ? 'Бұл сұрауды жібермесеңіз, хатты елемеңіз. Кодты ешкімге бермеңіз.' : 'Если вы не запрашивали вход, проигнорируйте письмо. Никому не сообщайте код.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.AUTH_MAIL_FROM, to: [email], subject, text }),
  });
  if (!response.ok) throw new Error('DELIVERY_FAILED');
}
async function twilio(path: string, values: Record<string, string>) {
  if (!smsLoginReady()) throw new Error('DELIVERY_UNAVAILABLE');
  const service = process.env.TWILIO_VERIFY_SERVICE_SID!;
  if (!/^VA[a-f0-9]{32}$/i.test(service)) throw new Error('DELIVERY_CONFIGURATION');
  return fetch(`https://verify.twilio.com/v2/Services/${service}/${path}`, {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { Authorization: 'Basic ' + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values),
  });
}
export async function deliverSms(phoneNumber: string) {
  // Verify owns code generation, expiry and consumption; never send Better Auth's local code.
  const response = await twilio('Verifications', { To: phoneNumber, Channel: 'sms' });
  if (!response.ok) throw new Error('DELIVERY_FAILED');
}
export async function verifySms(phoneNumber: string, code: string) {
  const response = await twilio('VerificationCheck', { To: phoneNumber, Code: code });
  if (!response.ok) return false;
  const data = await response.json();
  return data.status === 'approved' && data.valid === true;
}
