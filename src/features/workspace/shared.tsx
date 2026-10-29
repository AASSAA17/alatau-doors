'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter } from '@/lib/i18n/navigation';
import { useSessionState } from '@/store/session';
import { useFavorites } from '@/store/favorites';

export function Feedback({ error, success }: { error?: string; success?: string }) {
  const t = useTranslations('Workspace');
  return (
    <>
      {error && (
        <p className="form-error" role="alert">
          {t.has(`errors.${error}`) ? t(`errors.${error}`) : t('errors.SERVER_ERROR')}
        </p>
      )}
      {success && (
        <p className="form-success" role="status">
          {success}
        </p>
      )}
    </>
  );
}
export function useFeedback() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  return { busy, setBusy, error, setError, success, setSuccess };
}
export function SignOutButton() {
  const t = useTranslations('Workspace');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="secondary-button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const result = await authClient.signOut();
        if (!result.error) {
          useSessionState.getState().setActor(null);
          useFavorites.getState().connect(null, []);
          router.push('/sign-in');
          router.refresh();
        }
        setBusy(false);
      }}
    >
      {t('signOut')}
    </button>
  );
}
