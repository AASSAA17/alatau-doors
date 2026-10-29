import { pageActor, WorkspaceShell } from '@/features/workspace/shell';
import { users } from '@/lib/server/workspace';
import { AdminUsers } from '@/features/workspace/admin-users';
import { publicDemo } from '@/lib/server/environment';
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
      <AdminUsers users={await users()} restricted={publicDemo} />
    </WorkspaceShell>
  );
}
