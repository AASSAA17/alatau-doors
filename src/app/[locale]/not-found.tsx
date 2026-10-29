import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';
export default async function NotFound() {
  const t = await getTranslations('Errors');
  const c = await getTranslations('Common');
  return (
    <div className="empty-state shell">
      <p className="eyebrow">404 / ALATAU DOORS</p>
      <h1>{t('notFound')}</h1>
      <p>{t('notFoundText')}</p>
      <Link className="text-link" href="/catalog">
        {c('backCatalog')} ↗
      </Link>
    </div>
  );
}
