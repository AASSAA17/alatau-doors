import { pageActor, WorkspaceShell } from '@/features/workspace/shell';
import { ProfileForm } from '@/features/workspace/profile-form';
import { publicDemo } from '@/lib/server/environment';
import { sharedDemoAccount } from '@/lib/server/public-demo';
export default async function Page({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const { locale } = await params;
  const actor = await pageActor(locale);
  return (
    <WorkspaceShell actor={actor}>
      <ProfileForm actor={actor} sharedDemo={publicDemo && sharedDemoAccount(actor.email)} />
    </WorkspaceShell>
  );
}
