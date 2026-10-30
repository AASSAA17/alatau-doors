'use client';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import { workspaceRequest } from '@/lib/workspace-client';
import { authClient } from '@/lib/auth-client';
import { Feedback, useFeedback } from './shared';
import type { Actor } from '@/types/workspace';
export function ProfileForm({ actor, sharedDemo = false, hasPassword = true }: { actor: Actor; sharedDemo?: boolean; hasPassword?: boolean }) {
  const t = useTranslations('Workspace');
  const router = useRouter();
  const f = useFeedback();
  const pw = useFeedback();
  return (
    <>
      <h1>{t('profile')}</h1>
      <form
        className="workspace-form panel"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          f.setBusy(true);
          f.setError('');
          f.setSuccess('');
          try {
            await workspaceRequest({
              action: 'profile',
              name: form.get('name'),
              phone: form.get('phone'),
            });
            f.setSuccess(t('saved'));
            router.refresh();
          } catch (e) {
            f.setError((e as Error).message);
          } finally {
            f.setBusy(false);
          }
        }}
      >
        <label>
          {t('name')}
          <input name="name" defaultValue={actor.name} required minLength={2} maxLength={100} />
        </label>
        <label>
          {t('phone')}
          <input name="phone" type="tel" defaultValue={actor.phone} maxLength={30} />
        </label>
        {!actor.email.endsWith('@phone.invalid') && <><label>
          {t('email')}
          <input value={actor.email} readOnly />
        </label>
        <p>{t('emailFixed')}</p></>}
        <Feedback error={f.error} success={f.success} />
        <button disabled={f.busy} className="primary-button">
          {t('save')}
        </button>
      </form>
      {sharedDemo ? (
        <p className="demo-caption">{t('sharedPasswordNote')}</p>
      ) : !hasPassword ? (
        <p className="demo-caption">{t('googlePasswordNote')}</p>
      ) : (
        <form
          className="workspace-form panel"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const data = new FormData(form);
            pw.setBusy(true);
            pw.setError('');
            pw.setSuccess('');
            try {
              const result = await authClient.changePassword({
                currentPassword: String(data.get('current')),
                newPassword: String(data.get('next')),
                revokeOtherSessions: true,
              });
              if (result.error) pw.setError('AUTH_FAILED');
              else {
                form.reset();
                pw.setSuccess(t('saved'));
              }
            } catch {
              pw.setError('SERVER_ERROR');
            } finally {
              pw.setBusy(false);
            }
          }}
        >
          <h2>{t('changePassword')}</h2>
          <label>
            {t('currentPassword')}
            <input name="current" type="password" required autoComplete="current-password" />
          </label>
          <label>
            {t('newPassword')}
            <input
              name="next"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <Feedback error={pw.error} success={pw.success} />
          <button className="secondary-button" disabled={pw.busy}>
            {t('changePassword')}
          </button>
        </form>
      )}
    </>
  );
}
