'use client';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import { workspaceRequest } from '@/lib/workspace-client';
import { Feedback, useFeedback } from './shared';
import type { StoreSettings } from '@/types/workspace';
export function SettingsForm({ settings }: { settings: StoreSettings }) {
  const t = useTranslations('Workspace');
  const router = useRouter();
  const f = useFeedback();
  return (
    <>
      <h1>{t('settings')}</h1>
      <p className="workspace-note">{t('contactsNote')}</p>
      <form
        className="panel workspace-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const data = Object.fromEntries(
            Object.keys(settings).map((k) => [
              k,
              k.endsWith('Price') ? Number(form.get(k)) : String(form.get(k) || ''),
            ]),
          );
          f.setBusy(true);
          f.setError('');
          f.setSuccess('');
          try {
            await workspaceRequest({ action: 'settings', data });
            f.setSuccess(t('saved'));
            router.refresh();
          } catch (e) {
            f.setError((e as Error).message);
          } finally {
            f.setBusy(false);
          }
        }}
      >
        <h2>{t('contacts')}</h2>
        <div className="form-grid">
          {(['phone', 'email', 'addressRu', 'addressKk', 'hoursRu', 'hoursKk'] as const).map(
            (k) => (
              <label key={k}>
                {t(k)}
                <input
                  name={k}
                  type={k === 'email' ? 'email' : 'text'}
                  defaultValue={settings[k]}
                  maxLength={k === 'phone' ? 40 : 300}
                />
              </label>
            ),
          )}
        </div>
        <h2>{t('servicePrices')}</h2>
        <p className="workspace-note">{t('servicePriceNote')}</p>
        <div className="form-grid">
          {(['framePrice', 'hardwarePrice', 'installationPrice'] as const).map((k) => (
            <label key={k}>
              {t(k)}
              <input
                name={k}
                type="number"
                required
                min={0}
                max={10000000}
                defaultValue={settings[k]}
              />
            </label>
          ))}
        </div>
        <Feedback error={f.error} success={f.success} />
        <button disabled={f.busy} className="primary-button">
          {t('save')}
        </button>
      </form>
    </>
  );
}
