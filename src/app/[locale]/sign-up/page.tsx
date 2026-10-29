import { AuthForm } from '@/features/workspace/auth-form';
import { publicDemo } from '@/lib/server/environment';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    returnTo?: string;
  }>;
}) {
  const { returnTo } = await searchParams;
  return (
    <div className="shell auth-page">
      <AuthForm
        register
        invitationRequired={publicDemo}
        returnToSelection={returnTo === 'selection'}
      />
    </div>
  );
}
