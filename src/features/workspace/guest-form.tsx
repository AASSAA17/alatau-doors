'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
export function GuestForm() {
  const t = useTranslations('Guest'), locale = useLocale();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [id, setId] = useState('');
  return <section className="auth-card"><p className="eyebrow">ALATAU DOORS</p><h1>{t('title')}</h1><p>{t('note')}</p>
    {id ? <div role="status"><h2>{t('success')}</h2><p>{t('savedNote')}</p><code>{id}</code><p><Link href="/catalog" className="text-link">{t('catalog')}</Link></p></div>
      : <form className="workspace-form" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setError('');
        const data = new FormData(event.currentTarget);
        try {
          const response = await fetch('/api/guest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            name: data.get('name'), contact: String(data.get('contact')).trim(), note: data.get('note'), locale, consent: data.get('consent') === 'on', website: data.get('website') || '',
          }) });
          const result = await response.json();
          if (!response.ok) { setError(t(response.status === 429 ? 'wait' : 'failed')); return; }
          setId(result.id);
        } catch { setError(t('failed')); } finally { setBusy(false); }
      }}>
        <label>{t('name')}<input name="name" autoComplete="name" minLength={2} maxLength={100} required /></label>
        <label>{t('contact')}<input name="contact" autoComplete="email" maxLength={254} required placeholder="name@example.com / +77001234567" /></label>
        <label>{t('message')}<textarea name="note" minLength={5} maxLength={2000} rows={4} required /></label>
        <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <label className="entry-consent"><input name="consent" type="checkbox" required />{t('consent')}</label>
        <Link href="/privacy" className="text-link">{t('privacy')}</Link>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={busy}>{t(busy ? 'sending' : 'send')}</button>
      </form>}
  </section>;
}
