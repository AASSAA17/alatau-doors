import { accountSecurityRequired } from '@/lib/server/auth-policy';
import { mailReady } from '@/lib/server/auth-mail';
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
      <AuthForm emailVerificationRequired={accountSecurityRequired} recoveryEnabled={mailReady()} emailEnabled={emailLoginReady()} smsEnabled={smsLoginReady()} returnToSelection={returnTo === 'selection'} googleEnabled={googleConfigured} googleError={google === 'error'}/>
    </div>
  );
}
