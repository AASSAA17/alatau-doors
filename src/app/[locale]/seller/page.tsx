import { Dashboard } from '@/features/workspace/dashboard';
import { pageActor } from '@/features/workspace/shell';
export default async function Page({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  const actor = await pageActor(locale, ['SELLER']);
  return <Dashboard actor={actor} locale={locale} />;
}
