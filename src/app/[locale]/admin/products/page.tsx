import { pageActor, WorkspaceShell } from '@/features/workspace/shell';
import { readProducts } from '@/lib/server/products';
import { AdminProducts } from '@/features/workspace/admin-products';
export default async function Page({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  const actor = await pageActor(locale, ['ADMIN']);
  return (
    <WorkspaceShell actor={actor}>
      <AdminProducts products={await readProducts(true)} />
    </WorkspaceShell>
  );
}
