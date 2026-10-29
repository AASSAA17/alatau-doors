import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CatalogPage, type SearchParams } from '@/features/catalog/catalog-page';
export async function generateMetadata({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Common' });
  return { title: t('catalog') };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CatalogPage searchParams={await searchParams} />;
}
