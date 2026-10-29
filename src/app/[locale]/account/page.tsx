import { Dashboard } from '@/features/workspace/dashboard';
import { pageActor } from '@/features/workspace/shell';
import { redirect } from 'next/navigation';
export default async function Page({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  const actor = await pageActor(locale);
  if (actor.role !== 'BUYER') redirect(`/${locale}/${actor.role === 'ADMIN' ? 'admin' : 'seller'}`);
  return <Dashboard actor={actor} locale={locale} />;
}
