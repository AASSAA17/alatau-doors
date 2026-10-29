import { getTranslations, setRequestLocale } from 'next-intl/server';
import { productRepository } from '@/lib/catalog';
import { FavoritesGrid } from '@/features/favorites/favorites-grid';
import { ProductCard } from '@/components/product-card';
import { headers } from 'next/headers';
import { getActor } from '@/lib/server/access';
import { WorkspaceShell } from '@/features/workspace/shell';
export async function generateMetadata({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Common' });
  return { title: t('favorites') };
}
export default async function Page({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Favorites');
  const products = await productRepository.list();
  const actor = await getActor(await headers());
  const content = (
    <div className={actor?.role === 'BUYER' ? 'favorites-page' : 'shell favorites-page'}>
      <div className="page-heading">
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1>{t('title')}</h1>
        <p>{t('intro')}</p>
      </div>
      <FavoritesGrid
        cards={products.map((p) => ({ id: p.id, node: <ProductCard product={p} /> }))}
      />
    </div>
  );
  return actor?.role === 'BUYER' ? (
    <WorkspaceShell actor={actor}>{content}</WorkspaceShell>
  ) : (
    content
  );
}
