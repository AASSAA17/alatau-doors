import { AuthForm } from '@/features/workspace/auth-form';
import { googleConfigured } from '@/lib/server/google-auth';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    returnTo?: string;
    google?: string;
  }>;
}) {
  const { returnTo, google } = await searchParams;
  return (
    <div className="shell auth-page">
      <AuthForm returnToSelection={returnTo === 'selection'} googleEnabled={googleConfigured} googleError={google === 'error'}/>
    </div>
  );
}
