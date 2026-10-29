import { notFound } from 'next/navigation';
import { AppError } from '@/lib/server/access';
import { requestDetail, users } from '@/lib/server/workspace';
import { readProducts, getSettings } from '@/lib/server/products';
import { pageActor, WorkspaceShell } from '@/features/workspace/shell';
import { RequestEditor } from '@/features/workspace/request-editor';
export default async function Page({
  params,
}: {
  params: Promise<{
    locale: string;
    id: string;
  }>;
}) {
  const { locale, id } = await params;
  const actor = await pageActor(locale);
  let detail;
  try {
    detail = await requestDetail(actor, id);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  return (
    <WorkspaceShell actor={actor}>
      <RequestEditor
        key={`${id}-${detail.revision}`}
        actor={actor}
        detail={detail}
        products={await readProducts(true)}
        settings={await getSettings()}
        sellers={
          actor.role === 'ADMIN'
            ? (await users())
                .filter((u) => u.role === 'SELLER' && u.active)
                .map((u) => ({ id: u.id, name: u.name }))
            : []
        }
      />
    </WorkspaceShell>
  );
}
