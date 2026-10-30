import { accountSecurityRequired } from '@/lib/server/auth-policy';
import { mailReady } from '@/lib/server/auth-mail';
import { AuthForm } from '@/features/workspace/auth-form';
import { publicDemo } from '@/lib/server/environment';
import { googleConfigured } from '@/lib/server/google-auth';
import { emailLoginReady, smsLoginReady } from '@/lib/server/passwordless-delivery';
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
      <AuthForm emailVerificationRequired={accountSecurityRequired} recoveryEnabled={mailReady()}
        register
        emailEnabled={emailLoginReady()}
        smsEnabled={smsLoginReady()}
        googleEnabled={googleConfigured}
        demoRegistration={publicDemo}
        returnToSelection={returnTo === 'selection'}
      />
    </div>
  );
}
