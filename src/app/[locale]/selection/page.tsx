import { readProducts, getSettings } from '@/lib/server/products';
import { readDraft } from '@/lib/server/workspace';
import { Selection } from '@/features/workspace/selection';
import { WorkspaceShell, optionalPageActor } from '@/features/workspace/shell';
export default async function Page({params}: {params: Promise<{locale:string}>}) {
  const {locale} = await params;
  const actor = await optionalPageActor(locale);
  const content = (
    <Selection
      actor={actor}
      initialLines={actor?.role === 'BUYER' ? await readDraft(actor.id) : []}
      products={await readProducts()}
      settings={await getSettings()}
    />
  );
  return actor ? (
    <WorkspaceShell actor={actor}>{content}</WorkspaceShell>
  ) : (
    <div className="shell selection-page">{content}</div>
  );
}
