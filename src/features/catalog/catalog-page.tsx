import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { SearchX } from 'lucide-react';
import { productRepository } from '@/lib/catalog';
import { Link } from '@/lib/i18n/navigation';
import { ProductCard } from '@/components/product-card';
import { CatalogControls } from './catalog-controls';
import type { Category } from '@/types/product';
export type SearchParams = Record<string, string | string[] | undefined>;
export async function CatalogPage({
  category,
  searchParams,
}: {
  category?: Category;
  searchParams: SearchParams;
}) {
  const t = await getTranslations('Catalog');
  const c = await getTranslations('Common');
  const value = (key: string) =>
    typeof searchParams[key] === 'string' ? (searchParams[key] as string) : undefined;
  const selectedCategory =
    category ??
    (['interior', 'entrance'].includes(value('category') ?? '')
      ? (value('category') as Category)
      : undefined);
  const max = Number(value('maxPrice'));
  const products = await productRepository.list({
    q: value('q'),
    category: selectedCategory,
    maxPrice: Number.isFinite(max) && max > 0 ? max : undefined,
    sort: value('sort'),
  });
  return (
    <div className="shell catalog-page">
      <nav className="breadcrumbs" aria-label={c('navigation')}>
        <Link href="/">{c('home')}</Link>
        <span>/</span>
        {category ? (
          <>
            <Link href="/catalog">{c('catalog')}</Link>
            <span>/</span>
            <span>{c(category)}</span>
          </>
        ) : (
          <span>{c('catalog')}</span>
        )}
      </nav>
      <div className="page-heading">
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1>{t(category ? `${category}Title` : 'title')}</h1>
        <p>{t('intro')}</p>
      </div>
      <div className="catalog-tabs">
        <Link href="/catalog" className={!category ? 'active' : ''}>
          {c('allDoors')}
        </Link>
        <Link href="/catalog/interior" className={category === 'interior' ? 'active' : ''}>
          {c('interior')}
        </Link>
        <Link href="/catalog/entrance" className={category === 'entrance' ? 'active' : ''}>
          {c('entrance')}
        </Link>
      </div>
      <Suspense>
        <CatalogControls category={category}>
      <div className="catalog-result-summary" aria-live="polite">
        <span>{t('results', { count: products.length })}</span>
        <span>ALATAU / DEMO COLLECTION</span>
      </div>
      {products.length ? (
        <div className="product-grid catalog-product-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <SearchX size={40} strokeWidth={1} />
          <h2>{t('emptyTitle')}</h2>
          <p>{t('emptyText')}</p>
          <Link href={category ? `/catalog/${category}` : '/catalog'} className="text-link">
            {t('reset')}
            <span>↗</span>
          </Link>
        </div>
      )}
      <p className="catalog-note">{t('note')}</p>
        </CatalogControls>
      </Suspense>
    </div>
  );
}
