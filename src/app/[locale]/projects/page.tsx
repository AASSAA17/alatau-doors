import Image from 'next/image';
import { getLocale, getTranslations } from 'next-intl/server';
import { interiorIdeas } from '@/data/editorial';
import { Link } from '@/lib/i18n/navigation';
export async function generateMetadata() {
  const t = await getTranslations('Editorial');
  return { title: t('ideas') };
}
export default async function Page() {
  const locale = (await getLocale()) === 'kk' ? 'kk' : 'ru';
  const t = await getTranslations('Editorial');
  return (
    <div className="shell editorial-page">
      <div className="page-heading">
        <h1>{t('ideas')}</h1>
        <p>{t('ideasIntro')}</p>
      </div>
      <div className="interior-ideas">
        {interiorIdeas.map((idea) => (
          <article className="interior-idea" key={idea.id}>
            <figure>
              <Image
                src={idea.image}
                alt={idea.title[locale]}
                fill
                sizes="(max-width:760px) 90vw, 45vw"
              />
              <figcaption>{t('aiLabel')}</figcaption>
            </figure>
            <div>
              <h2>{idea.title[locale]}</h2>
              <p>{idea.text[locale]}</p>
              <Link className="secondary-button" href={`/catalog/${idea.category}`}>
                {t(idea.category)} →
              </Link>
            </div>
          </article>
        ))}
      </div>
      <nav className="editorial-actions" aria-label={t('next')}>
        <Link href="/door-finder" className="primary-button">
          {t('finder')} →
        </Link>
        <Link href="/contacts" className="text-link">
          {t('contacts')} ↗
        </Link>
      </nav>
    </div>
  );
}
