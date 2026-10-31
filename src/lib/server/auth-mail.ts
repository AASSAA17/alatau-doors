import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { waitUntil } from '@vercel/functions';
import { getDb } from './db';

type Purpose = 'verify' | 'reset' | 'password-changed';
export const tokenDigest = (token: string) => createHash('sha256').update(token).digest('hex');
export function mailReady() {
  if (process.env.AUTH_MAIL_PROVIDER === 'resend')
    return Boolean(process.env.RESEND_API_KEY && process.env.AUTH_MAIL_FROM);
  if (process.env.AUTH_MAIL_PROVIDER !== 'test' || process.env.VERCEL) return false;
  const origin = new URL(process.env.BETTER_AUTH_URL || 'http://invalid');
  const dir = resolve(/*turbopackIgnore: true*/ process.env.AUTH_TEST_MAIL_DIR || '');
  return ['127.0.0.1', 'localhost'].includes(origin.hostname) &&
    Boolean(process.env.ALATAU_TEST_RUN) && dir.startsWith(resolve('.local') + sep);
}
export async function sendVerificationCode(email: string, code: string, locale: string) {
  if (!mailReady()) throw new Error('AUTH_MAIL_UNAVAILABLE');
  const ru = locale !== 'kk';
  const subject = ru ? 'Код подтверждения email — Alatau Doors' : 'Email растау коды — Alatau Doors';
  const text = `${subject}\n\n${code}\n\n${ru
    ? 'Код действует 5 минут и используется один раз. Новый код отменяет предыдущий. Никому не сообщайте код. Если вы не регистрировались, проигнорируйте письмо.'
    : 'Код 5 минут жарамды және бір рет қолданылады. Жаңа код алдыңғысын жояды. Кодты ешкімге бермеңіз. Тіркелмеген болсаңыз, хатты елемеңіз.'}`;
  const deliver = async () => {
    if (process.env.AUTH_MAIL_PROVIDER === 'test') {
      const dir = resolve(/*turbopackIgnore: true*/ process.env.AUTH_TEST_MAIL_DIR!);
      await mkdir(dir, {recursive:true});
      await writeFile(resolve(dir, randomUUID() + '.json'), JSON.stringify({to:email, purpose:'verify-code', code, subject, text}), {mode:0o600});
      return;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method:'POST', signal:AbortSignal.timeout(8000),
      headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type':'application/json'},
      body:JSON.stringify({from:process.env.AUTH_MAIL_FROM, to:[email], subject, text}),
    });
    if (!response.ok) throw new Error('MAIL_DELIVERY_FAILED');
  };
  if (process.env.VERCEL) waitUntil(deliver().catch(() => { console.error('Verification code delivery failed.'); }));
  else await deliver();
}
export async function sendAuthMail(
  user: { id: string; email: string }, purpose: Purpose, token?: string, request?: Request,
) {
  if (!mailReady()) throw new Error('AUTH_MAIL_UNAVAILABLE');
  const locale = request?.headers.get('x-alatau-locale') === 'kk' ? 'kk' : 'ru';
  const origin = process.env.BETTER_AUTH_URL!;
  const path = purpose === 'verify' ? 'verify-email' : 'reset-password';
  const url = token ? `${origin}/${locale}/${path}#token=${encodeURIComponent(token)}` : '';
  const ru = locale === 'ru';
  const subject = purpose === 'verify'
    ? (ru ? 'Подтвердите email — Alatau Doors' : 'Email мекенжайын растаңыз — Alatau Doors')
    : purpose === 'reset'
      ? (ru ? 'Восстановление пароля — Alatau Doors' : 'Құпиясөзді қалпына келтіру — Alatau Doors')
      : (ru ? 'Пароль изменён — Alatau Doors' : 'Құпиясөз өзгертілді — Alatau Doors');
  const text = token
    ? `${subject}\n\n${url}\n\n${ru ? 'Ссылка действует 15 минут. Если вы не запрашивали это письмо, проигнорируйте его.' : 'Сілтеме 15 минут жарамды. Бұл хатты сұрамасаңыз, оны елемеңіз.'}`
    : (ru ? 'Пароль вашего аккаунта Alatau Doors изменён. Если это сделали не вы, восстановите пароль через сайт и обратитесь к организатору.' : 'Alatau Doors аккаунтының құпиясөзі өзгертілді. Егер оны сіз өзгертпесеңіз, сайт арқылы құпиясөзді қалпына келтіріп, ұйымдастырушыға хабарласыңыз.');
  const deliver = async () => {
    // Keep the ledger write inside the background job on Vercel. Signup's auth
    // transaction can then release its pool connection before this job needs one.
    if (purpose === 'verify' && token) {
      await getDb().prepare('DELETE FROM auth_links WHERE expiresAt<=?').run(Date.now());
      await getDb().prepare(
        'INSERT INTO auth_links(id,userId,expiresAt) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING',
      ).run(tokenDigest(token), user.id, Date.now() + 15 * 60_000);
    }
    if (process.env.AUTH_MAIL_PROVIDER === 'test') {
      const dir = resolve(/*turbopackIgnore: true*/ process.env.AUTH_TEST_MAIL_DIR!);
      await mkdir(dir, { recursive: true });
      await writeFile(resolve(dir, randomUUID() + '.json'), JSON.stringify({ to: user.email, purpose, subject, text, url }), { mode: 0o600 });
      return;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.AUTH_MAIL_FROM, to: [user.email], subject, text }),
    });
    if (!response.ok) throw new Error('MAIL_DELIVERY_FAILED');
  };
  if (process.env.VERCEL) waitUntil(deliver().catch(() => { console.error('Authentication email delivery failed.'); }));
  else await deliver();
}
