import { pageActor, WorkspaceShell } from '@/features/workspace/shell';
import { getSettings } from '@/lib/server/products';
import { SettingsForm } from '@/features/workspace/settings-form';
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
      <SettingsForm settings={await getSettings()} />
    </WorkspaceShell>
  );
}
