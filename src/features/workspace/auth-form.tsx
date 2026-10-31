'use client';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { authClient } from '@/lib/auth-client';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { authDestination } from './auth-navigation';
import { Feedback, useFeedback } from './shared';
import { PasswordlessForm } from './passwordless-form';
import { normalizePhone } from '@/lib/phone';
export function AuthForm({
  register = false,
  returnToSelection = false,
  demoRegistration = false,
  googleEnabled = false,
  googleError = false,
  emailVerificationRequired = false,
  recoveryEnabled = false,
  emailEnabled = false,
  smsEnabled = false,
}: {
  register?: boolean;
  returnToSelection?: boolean;
  demoRegistration?: boolean;
  googleEnabled?: boolean;
  googleError?: boolean;
  emailVerificationRequired?: boolean;
  recoveryEnabled?: boolean;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
}) {
  const t = useTranslations('Workspace');
  const security = useTranslations('AccountSecurity');
  const locale = useLocale();
  const router = useRouter();
  const f = useFeedback();
  return (
    <section className="auth-card">
      <p className="eyebrow">ALATAU DOORS</p>
      <h1>{t(register ? 'registerTitle' : 'signInTitle')}</h1>
      <p>{t(register ? 'registerNote' : 'signInNote')}</p>
      {register && demoRegistration && <p className="demo-caption">{t('demoRegistrationNote')}</p>}
      {googleError && <p className="form-error" role="alert">{t('googleError')}</p>}
      {googleEnabled && <div className="google-sign-in">
        <button type="button" className="google-auth-button" disabled={f.busy} onClick={async () => {
          f.setBusy(true); f.setError('');
          try {
            const destination = `/${locale}/${returnToSelection ? 'selection' : 'account'}`;
            const result = await authClient.signIn.social({provider:'google', callbackURL:destination,
              newUserCallbackURL:destination, errorCallbackURL:`/${locale}/sign-in?google=error`});
            if (result.error) { f.setError('AUTH_FAILED'); f.setBusy(false); }
          } catch { f.setError('SERVER_ERROR'); f.setBusy(false); }
        }}><Image src="/brand/google-g.png" width={20} height={20} alt="" unoptimized />{t('continueGoogle')}</button>
        <p className="demo-caption">{t('googleBuyerOnly')}</p>
        <p className="demo-caption">{t('googleDataNote')} <Link href="/privacy">{t('privacy')}</Link></p>
        <p className="demo-caption">{t('orPassword')}</p>
      </div>}
      <PasswordlessForm emailEnabled={emailEnabled} smsEnabled={smsEnabled} selection={returnToSelection}/>
      <form
        className="workspace-form"
        onSubmit={async (e) => {
          e.preventDefault();
          f.setBusy(true);
          f.setError('');
          const data = new FormData(e.currentTarget);
          try {
            const email = String(data.get('email'));
            const password = String(data.get('password'));
            const phone = register ? normalizePhone(String(data.get('phone'))) : null;
            if (register && !phone) { f.setError('INVALID_PHONE'); return; }
            const result = register
              ? await authClient.signUp.email({ name: String(data.get('name')), email, password, phone: phone! }, { headers: { 'x-alatau-locale': locale } })
              : await authClient.signIn.email({ email, password });
            if (result.error) {
              f.setError(
                ['DEMO_LIMIT', 'EMAIL_NOT_VERIFIED', 'AUTH_MAIL_UNAVAILABLE'].includes(result.error.code || '')
                  ? result.error.code!
                  : result.error.status === 429
                    ? 'RATE_LIMIT'
                    : 'AUTH_FAILED',
              );
              return;
            }
            if (register && emailVerificationRequired) {
              router.push('/verify-email?sent=1');
              return;
            }
            if (result.data && 'twoFactorRedirect' in result.data && result.data.twoFactorRedirect) {
              router.push('/security?challenge=1');
              return;
            }
            router.push(await authDestination(returnToSelection));
            router.refresh();

          } catch {
            f.setError('SERVER_ERROR');
          } finally {
            f.setBusy(false);
          }
        }}
      >
        {register && (
          <label>
            {t('name')}
            <input name="name" required minLength={2} maxLength={100} autoComplete="name" />
          </label>
        )}
        {register && <><label>{t('phone')}<input name="phone" type="tel" required maxLength={30} autoComplete="tel" placeholder="+7 700 123 45 67" aria-describedby="registration-phone-hint"/></label><small id="registration-phone-hint">{t('registrationPhoneHint')}</small></>}
        <label>
          {t('email')}
          <input name="email" type="email" required maxLength={254} autoComplete="email" />
        </label>
        <label>
          {t('password')}
          <input
            name="password"
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete={register ? 'new-password' : 'current-password'}
          />
        </label>
        <small>{t('passwordHint')}</small>
        <Feedback error={f.error} />
        <button className="primary-button" disabled={f.busy}>
          {t(f.busy ? 'saving' : register ? 'register' : 'signIn')}
        </button>
      </form>
      <Link
        className="text-link"
        href={`${register ? '/sign-in' : '/sign-up'}${returnToSelection ? '?returnTo=selection' : ''}`}
      >
        {t(register ? 'haveAccount' : 'newAccount')}
      </Link>
<p>{!register && recoveryEnabled && <Link className="text-link" href="/forgot-password">{security('forgotTitle')}</Link>}</p>
      {recoveryEnabled && <p><Link className="text-link" href="/verify-email">{security('verifyTitle')}</Link></p>}
      <p className="demo-caption">{t('demoCredentialsNote')}</p>
    </section>
  );
}
