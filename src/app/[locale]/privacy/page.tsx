import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations('Privacy');
  return { title: t('title') };
}
export default async function Page() {
  const t = await getTranslations('Privacy');
  return <div className="shell editorial-page">
    <div className="page-heading"><p className="eyebrow">ALATAU DOORS · DEMO</p><h1>{t('title')}</h1><p>{t('intro')}</p></div>
    <div className="editorial-sections">{['data', 'use', 'access', 'storage', 'choice'].map(key =>
      <section className="panel" key={key}><h2>{t(`${key}Title`)}</h2><p>{t(key)}</p></section>)}
      <section className="panel"><h2>{t('contactTitle')}</h2><p>{t('contact')}</p><a className="text-link" href="mailto:aitkazinov2006@gmail.com">aitkazinov2006@gmail.com</a></section>
    </div>
  </div>;
}
