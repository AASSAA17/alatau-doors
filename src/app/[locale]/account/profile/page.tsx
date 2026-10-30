import { pageActor, WorkspaceShell } from '@/features/workspace/shell';
import { ProfileForm } from '@/features/workspace/profile-form';
import { publicDemo } from '@/lib/server/environment';
import { sharedDemoAccount } from '@/lib/server/public-demo';
import { getDb } from '@/lib/server/db';
export default async function Page({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  const actor = await pageActor(locale);
  const passwordAccount = await getDb().prepare(
    'SELECT id FROM account WHERE "userId"=? AND "providerId"=? AND password IS NOT NULL',
  ).get(actor.id, 'credential');
  return (
    <WorkspaceShell actor={actor}>
      <ProfileForm actor={actor} hasPassword={Boolean(passwordAccount)} sharedDemo={publicDemo && sharedDemoAccount(actor.email)} />
    </WorkspaceShell>
  );
}
