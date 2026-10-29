import { DoorFinder, type FinderAnswers } from '@/features/finder/door-finder';
import { readProducts } from '@/lib/server/products';
import { getTranslations } from 'next-intl/server';
export async function generateMetadata() {
  const t = await getTranslations('Finder');
  return { title: t('title') };
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const integer = (value: unknown, min: number, max: number, fallback: number) =>
    typeof value === 'string' &&
    Number.isInteger(Number(value)) &&
    Number(value) >= min &&
    Number(value) <= max
      ? Number(value)
      : fallback;
  const initial: FinderAnswers = {
    step: integer(q.step, 1, 4, 1),
    category: q.type === 'entrance' ? 'entrance' : 'interior',
    quantity: integer(q.quantity, 1, 20, 1),
    budget:
      q.budget === undefined || q.budget === 'any' ? null : integer(q.budget, 1, 10000000, 150000),
  };
  return (
    <DoorFinder key={JSON.stringify(initial)} initial={initial} products={await readProducts()} />
  );
}
