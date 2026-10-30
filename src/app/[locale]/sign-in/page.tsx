import { AuthForm } from '@/features/workspace/auth-form';
import { googleConfigured } from '@/lib/server/google-auth';
import { emailLoginReady, smsLoginReady } from '@/lib/server/passwordless-delivery';
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
      <AuthForm emailEnabled={emailLoginReady()} smsEnabled={smsLoginReady()} returnToSelection={returnTo === 'selection'} googleEnabled={googleConfigured} googleError={google === 'error'}/>
    </div>
  );
}
