'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { authClient } from '@/lib/auth-client';
import { Link } from '@/lib/i18n/navigation';
import { Feedback, useFeedback } from './shared';
export function EmailSecurity({ mode }: { mode: 'verify' | 'forgot' | 'reset' }) {
  const t = useTranslations('AccountSecurity'); const w = useTranslations('Workspace'); const locale = useLocale();
  const f = useFeedback(); const [token, setToken] = useState(''); const [done, setDone] = useState(false);
  useEffect(() => {
    // Fragments are not sent to the web server or included in referrer headers.
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
    queueMicrotask(() => setToken(value));
    if (value) window.history.replaceState(null, '', window.location.pathname);
  }, []);
  return <section className="auth-card">
    <p className="eyebrow">ALATAU DOORS</p>
    <h1>{t(mode === 'verify' ? 'verifyTitle' : mode === 'forgot' ? 'forgotTitle' : 'resetTitle')}</h1>
    <p>{t(mode === 'verify' ? 'verifyNote' : mode === 'forgot' ? 'forgotNote' : 'resetNote')}</p>
    {!done && <form className="workspace-form" onSubmit={async event => {
      event.preventDefault(); f.setBusy(true); f.setError(''); f.setSuccess('');
      const data = new FormData(event.currentTarget);
      try {
        if (mode === 'verify' && token) {
          const response = await fetch('/api/account/verify-email', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token})});
          if (!response.ok) throw new Error('INVALID_TOKEN');
          setToken(''); setDone(true); f.setSuccess(t('verified'));
        } else if (mode === 'reset') {
          if (!token) throw new Error('INVALID_TOKEN');
          if (data.get('password') !== data.get('confirm')) throw new Error('PASSWORD_MISMATCH');
          const result = await authClient.resetPassword({token, newPassword:String(data.get('password'))}, {headers:{'x-alatau-locale':locale}});
          if (result.error) throw new Error('INVALID_TOKEN');
          setToken(''); setDone(true); f.setSuccess(t('resetDone'));
        } else {
          const email = String(data.get('email')); const options = {headers:{'x-alatau-locale':locale}};
          const result = mode === 'forgot' ? await authClient.requestPasswordReset({email}, options) : await authClient.sendVerificationEmail({email}, options);
          if (result.error) throw new Error(result.error.code === 'AUTH_MAIL_UNAVAILABLE' ? 'AUTH_MAIL_UNAVAILABLE' : result.error.status === 429 ? 'RATE_LIMIT' : 'SERVER_ERROR');
          f.setSuccess(t('mailAccepted'));
        }
      } catch (error) { f.setError((error as Error).message); }
      finally { f.setBusy(false); }
    }}>
      {(mode === 'forgot' || (mode === 'verify' && !token)) && <label>{w('email')}<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>}
      {mode === 'reset' && <>
        <label>{w('newPassword')}<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
        <label>{t('confirmPassword')}<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
        <small>{w('passwordHint')}</small>
      </>}
      <button className="primary-button" disabled={f.busy}>{f.busy ? w('saving') : t(mode === 'reset' ? 'savePassword' : mode === 'verify' && token ? 'confirmEmail' : 'sendLink')}</button>
    </form>}
    <Feedback error={f.error} success={f.success}/>
    <p><Link className="text-link" href="/sign-in">{w('signIn')}</Link></p>
    {mode === 'reset' && <p><Link className="text-link" href="/forgot-password">{t('newLink')}</Link></p>}
  </section>;
}
