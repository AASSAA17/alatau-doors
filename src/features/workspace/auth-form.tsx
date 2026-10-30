'use client';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { authClient } from '@/lib/auth-client';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { useSessionState } from '@/store/session';
import { useFavorites } from '@/store/favorites';
import { Feedback, useFeedback } from './shared';
export function AuthForm({
  register = false,
  returnToSelection = false,
  demoRegistration = false,
  googleEnabled = false,
  googleError = false,
}: {
  register?: boolean;
  returnToSelection?: boolean;
  demoRegistration?: boolean;
  googleEnabled?: boolean;
  googleError?: boolean;
}) {
  const t = useTranslations('Workspace');
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
            const result = register
              ? await authClient.signUp.email({ name: String(data.get('name')), email, password })
              : await authClient.signIn.email({ email, password });
            if (result.error) {
              f.setError(
                result.error.code === 'DEMO_LIMIT'
                  ? 'DEMO_LIMIT'
                  : result.error.status === 429
                    ? 'RATE_LIMIT'
                    : 'AUTH_FAILED',
              );
              return;
            }
            const me = await fetch('/api/workspace?resource=me', { cache: 'no-store' }).then((r) =>
              r.json(),
            );
            const role = me.actor?.role;
            if (!me.actor) {
              f.setError('AUTH_FAILED');
              return;
            }
            useSessionState.getState().setActor(me.actor);
            useFavorites.getState().connect(role === 'BUYER' ? me.actor.id : null, me.ids);
            router.push(
              role === 'ADMIN'
                ? '/admin'
                : role === 'SELLER'
                  ? '/seller'
                  : returnToSelection
                    ? '/selection'
                    : '/account',
            );
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
      <p className="demo-caption">{t('demoCredentialsNote')}</p>
    </section>
  );
}
