import Image from 'next/image';
import {
  ArrowRight,
  ArrowUpRight,
  DoorOpen,
  Layers,
  Calculator,
  ClipboardCheck,
} from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';
import { productRepository } from '@/lib/catalog';
import { ProductCard } from '@/components/product-card';
import { Reveal } from '@/components/reveal';
import { Button } from '@/components/ui/button';
import { ContactSection } from '@/components/contact-section';
export default async function Home({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Home');
  const c = await getTranslations('Common');
  const s = await getTranslations('Storefront');
  const products = await productRepository.list();
  return (
    <>
      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow hero-eyebrow">
            <span className="tiny-line" />
            {t('eyebrow')}
          </div>
          <h1>
            {t('title')}
            <span>{t('titleAccent')}</span>
          </h1>
          <p className="hero-description">{t('intro')}</p>
          <div className="hero-cta-row">
            <Button asChild className="primary-button">
              <Link href="/catalog">
                {t('explore')}
                <ArrowUpRight size={19} />
              </Link>
            </Button>
            <Link href="/selection" className="secondary-button">
              {s('secondAction')} ↗
            </Link>
          </div>
        </div>
        <div className="hero-visual">
          <Image src="/images/hero.webp" alt={c('visualization')} fill priority sizes="100vw" />
          <span className="hero-image-credit">{c('visualization')}</span>
        </div>
        <div className="hero-features">
          {[DoorOpen, Layers, Calculator, ClipboardCheck].map((Icon, i) => (
            <div key={i}>
              <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
              <span>{s(`benefit${i + 1}`)}</span>
            </div>
          ))}
        </div>
      </section>
      <section id="collections" className="section shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('categoriesLabel')}</p>
            <h2>{s('categoryTitle')}</h2>
          </div>
          <p className="section-description">{t('categoriesText')}</p>
        </div>
        <div className="category-grid">
          <Reveal>
            <Link href="/catalog/interior" className="category-card interior-category">
              <Image
                src="/images/oak.webp"
                alt={c('visualization')}
                fill
                sizes="(max-width: 700px) 100vw, 55vw"
              />
              <div className="category-caption">
                <div>
                  <span>{t('interiorTitle')}</span>
                  <h3>{t('interiorText')}</h3>
                </div>
                <span className="round-arrow">
                  <ArrowUpRight />
                </span>
              </div>
            </Link>
          </Reveal>
          <Reveal>
            <Link href="/catalog/entrance" className="category-card entrance-category">
              <Image
                src="/images/graphite.webp"
                alt={c('visualization')}
                fill
                sizes="(max-width: 700px) 100vw, 40vw"
              />
              <div className="category-caption">
                <div>
                  <span>{t('entranceTitle')}</span>
                  <h3>{t('entranceText')}</h3>
                </div>
                <span className="round-arrow">
                  <ArrowUpRight />
                </span>
              </div>
            </Link>
          </Reveal>
        </div>
      </section>
      <section className="section featured shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('featuredLabel')}</p>
            <h2>{s('featuredTitle')}</h2>
          </div>
          <Link href="/catalog" className="text-link">
            {t('allModels')}
            <ArrowUpRight size={19} />
          </Link>
        </div>
        <div className="product-grid">
          {products.slice(0, 4).map((product) => (
            <ProductCard product={product} key={product.id} />
          ))}
        </div>
      </section>
      <section className="purchase-section shell" id="purchase">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ALATAU DOORS</p>
            <h2>{s('howTitle')}</h2>
          </div>
          <p className="section-description">{s('howIntro')}</p>
        </div>
        <div className="purchase-steps">
          {[1, 2, 3].map((i) => (
            <article key={i}>
              <span className="step-number">0{i}</span>
              <h3>{s(`step${i}`)}</h3>
              <p>{s(`step${i}Text`)}</p>
            </article>
          ))}
        </div>
        <div className="kit-callout">
          <div>
            <h3>{s('kitTitle')}</h3>
            <p>{s('kitText')}</p>
          </div>
          <Link href="/selection" className="primary-button">
            {s('secondAction')} ↗
          </Link>
        </div>
      </section>
      <section id="materials" className="materials-section">
        <div className="shell materials-layout">
          <div>
            <p className="eyebrow">{t('materialsLabel')}</p>
            <h2>{t('materialsTitle')}</h2>
            <p className="materials-copy">{t('materialsText')}</p>
            <Link href="/catalog" className="text-link light-link">
              {t('materialLink')}
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="material-samples">
            {[
              ['oak', 'дуб'],
              ['ivory', 'эмаль'],
              ['graphite', 'графит'],
            ].map(([name, query], i) => (
              <Link
                href={{
                  pathname: '/catalog',
                  query: { q: locale === 'kk' && name === 'oak' ? 'емен' : query },
                }}
                className={`material-sample sample-${name}`}
                key={name}
              >
                <div className="sample-image">
                  <Image src={`/images/${name}.webp`} alt={t(name)} fill sizes="20vw" />
                </div>
                <span>0{i + 1}</span>
                <p>{t(name)}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <ContactSection />
    </>
  );
}
