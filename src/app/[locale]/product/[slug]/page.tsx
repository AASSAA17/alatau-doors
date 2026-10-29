import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Info } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { productRepository } from '@/lib/catalog';
import { Link } from '@/lib/i18n/navigation';
import { formatPrice } from '@/lib/utils';
import { ProductOptions } from '@/features/product/product-options';
import { ProductCard } from '@/components/product-card';
import type { Locale } from '@/types/product';
type Props = {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
};
export async function generateStaticParams() {
  return (await productRepository.list()).map((p) => ({ slug: p.slug }));
}
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const p = await productRepository.getBySlug(slug);
  return { title: p ? `${p.name} — Demo` : '404' };
}
export default async function ProductPage({ params }: Props) {
  const { locale: lang, slug } = await params;
  const locale = lang as Locale;
  setRequestLocale(locale);
  const product = await productRepository.getBySlug(slug);
  if (!product) notFound();
  const t = await getTranslations('Product');
  const c = await getTranslations('Common');
  const related = (await productRepository.list()).filter((p) => p.id !== product.id).slice(0, 3);
  return (
    <div className="shell product-page">
      <nav className="breadcrumbs" aria-label={c('navigation')}>
        <Link href="/">{c('home')}</Link>
        <span>/</span>
        <Link href="/catalog">{c('catalog')}</Link>
        <span>/</span>
        <span>{product.name}</span>
      </nav>
      <div className="product-detail-grid">
        <figure className="detail-image">
          <Image
            src={product.image}
            alt={`${product.name} — ${c('visualization')}`}
            fill
            priority
            sizes="(max-width: 800px) 100vw, 52vw"
          />
          <figcaption>{c('visualization')}</figcaption>
          <span className="detail-collection">{product.collection}</span>
        </figure>
        <div className="product-detail-copy">
          <p className="eyebrow">
            {c(product.category)} / {product.sku}
          </p>
          <h1>{product.name}</h1>
          <p className="detail-finish">
            <span className="color-swatch" style={{ background: product.color }} />
            {product.finish[locale]}
          </p>
          <div className="detail-price">
            {formatPrice(product.price, locale)}
            <span>{c('perLeaf')}</span>
          </div>
          <p className="detail-description">{product.description[locale]}</p>
          <p className="price-note">{t('priceNote')}</p>
          <ProductOptions product={product} />
        </div>
        <aside className="product-spec-panel">
          <details className="specifications" open>
            <summary>{t('specs')}</summary>
            <dl>
              <div>
                <dt>{t('material')}</dt>
                <dd>{product.material[locale]}</dd>
              </div>
              {product.coating && (
                <div>
                  <dt>{t('coating')}</dt>
                  <dd>{product.coating[locale]}</dd>
                </div>
              )}
              <div>
                <dt>{t('finish')}</dt>
                <dd>{product.finish[locale]}</dd>
              </div>
              <div>
                <dt>{t('height')}</dt>
                <dd>
                  {product.height} {t('unit')}
                </dd>
              </div>
              <div>
                <dt>{c('collection')}</dt>
                <dd>{product.collection}</dd>
              </div>
            </dl>
          </details>
          <div className="product-demo-note">
            <Info size={18} />
            <p>{t('demoNotice')}</p>
          </div>
        </aside>
      </div>
      <section className="section related-section">
        <div className="section-heading">
          <h2>{t('related')}</h2>
          <Link href="/catalog" className="text-link">
            {c('allDoors')} ↗
          </Link>
        </div>
        <div className="product-grid">
          {related.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
