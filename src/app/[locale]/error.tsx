'use client';
import { useTranslations } from 'next-intl';
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations('Errors');
  return (
    <div className="empty-state shell">
      <h1>{t('error')}</h1>
      <button type="button" className="text-link" onClick={reset}>
        {t('retry')}
      </button>
    </div>
  );
}
