import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CatalogPage, type SearchParams } from '@/features/catalog/catalog-page';
type Props = {
  params: Promise<{
    locale: string;
    category: string;
  }>;
  searchParams: Promise<SearchParams>;
};
export async function generateMetadata({ params }: Props) {
  const { locale, category } = await params;
  const t = await getTranslations({ locale, namespace: 'Common' });
  return { title: ['interior', 'entrance'].includes(category) ? t(category) : t('catalog') };
}
export default async function Page({ params, searchParams }: Props) {
  const { locale, category } = await params;
  setRequestLocale(locale);
  if (category !== 'interior' && category !== 'entrance') notFound();
  return <CatalogPage category={category} searchParams={await searchParams} />;
}
