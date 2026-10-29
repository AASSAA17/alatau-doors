import { getLocale, getTranslations } from 'next-intl/server';
import { aboutContent } from '@/data/editorial';
import { Link } from '@/lib/i18n/navigation';
export async function generateMetadata() {
  const t = await getTranslations('Editorial');
  return { title: t('about') };
}
export default async function Page() {
  const locale = (await getLocale()) === 'kk' ? 'kk' : 'ru';
  const t = await getTranslations('Editorial');
  return (
    <div className="shell editorial-page">
      <div className="page-heading">
        <p className="eyebrow">ALATAU DOORS · DEMO</p>
        <h1>{t('about')}</h1>
        <p>{aboutContent.intro[locale]}</p>
      </div>
      <div className="editorial-sections">
        {aboutContent.sections.map((s, i) => (
          <section className="panel" key={i}>
            <span className="eyebrow">0{i + 1}</span>
            <h2>{s.title[locale]}</h2>
            <p>{s.text[locale]}</p>
          </section>
        ))}
      </div>
      <nav className="editorial-actions" aria-label={t('next')}>
        <Link className="primary-button" href="/door-finder">
          {t('finder')} →
        </Link>
        <Link className="secondary-button" href="/catalog">
          {t('catalog')}
        </Link>
        <Link className="text-link" href="/contacts">
          {t('contacts')} ↗
        </Link>
      </nav>
    </div>
  );
}
