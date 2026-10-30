'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';

export function PasswordlessForm({ emailEnabled, smsEnabled, selection }: { emailEnabled: boolean; smsEnabled: boolean; selection: boolean }) {
  const t = useTranslations('Entry'), locale = useLocale();
  const [method, setMethod] = useState('code'), [sent, setSent] = useState(false);
  const [recipient, setRecipient] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [open, setOpen] = useState(false);
  const choices = [...(emailEnabled ? ['code', 'link'] : []), ...(smsEnabled ? ['sms'] : [])];
  const actualMethod = choices.includes(method) ? method : choices[0];
  const destination = `/${locale}/${selection ? 'selection' : 'account'}`;
  return <div className="entry-methods">
    {choices.length > 0 && <>
      <button className="secondary-button" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{t('passwordless')}</button>
      {open && <form className="workspace-form" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setError('');
        const code = String(new FormData(event.currentTarget).get('code') || '');
        const checking = sent && actualMethod !== 'link';
        try {
          if (!checking && Date.now() < resendAt) { setError(t('wait')); return; }
          const endpoint = actualMethod === 'sms' ? (checking ? 'phone-number/verify' : 'phone-number/send-otp')
            : actualMethod === 'link' ? 'sign-in/magic-link' : checking ? 'sign-in/email-otp' : 'email-otp/send-verification-otp';
          const body = actualMethod === 'sms' ? { phoneNumber: recipient, ...(checking ? { code } : {}) }
            : actualMethod === 'link' ? { email: recipient, callbackURL: destination, newUserCallbackURL: destination, errorCallbackURL: `/${locale}/sign-in` }
              : { email: recipient, ...(checking ? { otp: code, name: t('buyerName') } : { type: 'sign-in' }) };
          const response = await fetch('/api/auth/' + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-alatau-locale': locale }, body: JSON.stringify(body) });
          if (!response.ok) { setError(t(response.status === 429 ? 'wait' : 'failed')); return; }
          // A full navigation clears session-scoped client stores after passwordless login.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          if (checking) window.location.assign(destination);
          else { setSent(true); setResendAt(Date.now() + 60000); }
        } catch { setError(t('failed')); } finally { setBusy(false); }
      }}>
        <label>{t('method')}<select value={actualMethod} disabled={busy} onChange={(e) => { setMethod(e.target.value); setSent(false); setRecipient(''); setError(''); }}>
          {choices.map((choice) => <option value={choice} key={choice}>{t(choice)}</option>)}
        </select></label>
        <p className="demo-caption">{t(actualMethod === 'sms' ? 'phoneNote' : 'buyerOnly')}</p>
        <label>{t(actualMethod === 'sms' ? 'phone' : 'email')}<input required type={actualMethod === 'sms' ? 'tel' : 'email'}
          autoComplete={actualMethod === 'sms' ? 'tel' : 'email'} maxLength={254} value={recipient} readOnly={sent} disabled={busy}
          placeholder={actualMethod === 'sms' ? '+77001234567' : 'name@example.com'} pattern={actualMethod === 'sms' ? '\\+7[67][0-9]{9}' : undefined}
          onChange={(e) => setRecipient(e.target.value.trim())}/></label>
        {sent && <p role="status">{t(actualMethod === 'link' ? 'linkSent' : 'codeSent')}</p>}
        {sent && actualMethod !== 'link' && <label>{t('enterCode')}<input name="code" required pattern="[0-9]{6}" minLength={6} maxLength={6} inputMode="numeric" autoComplete="one-time-code" /></label>}
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="primary-button" disabled={busy}>{t(busy ? 'sending' : sent && actualMethod !== 'link' ? 'confirm' : 'send')}</button>
        {sent && <button type="button" className="text-link" disabled={busy} onClick={() => { setSent(false); setError(''); }}>{t('changeRecipient')}</button>}
        <p className="demo-caption">{t('dataNote')} <Link href="/privacy">{t('privacy')}</Link></p>
      </form>}
    </>}
    <Link className="text-link" href="/guest-request">{t('guest')}</Link>
  </div>;
}

export function EmailLinkConfirm() {
  const t = useTranslations('Entry');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <section className="auth-card"><h1>{t('linkConfirm')}</h1><p>{t('linkWarning')}</p>
    <button className="primary-button" disabled={busy} onClick={async () => {
      setBusy(true); setError('');
      const values = new URLSearchParams(window.location.hash.slice(1));
      window.history.replaceState(null, '', window.location.pathname);
      try {
        const response = await fetch('/api/auth/email-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(values)) });
        const data = await response.json();
        if (!response.ok || !/^\/(ru|kk)\/(account|selection)$/.test(data.destination || '')) { setError(t('linkFailed')); return; }
        window.location.assign(data.destination);
      } catch { setError(t('linkFailed')); } finally { setBusy(false); }
    }}>{t(busy ? 'sending' : 'confirm')}</button>
    {error && <p role="alert" className="form-error">{error}</p>}<Link className="text-link" href="/sign-in">{t('back')}</Link>
  </section>;
}
