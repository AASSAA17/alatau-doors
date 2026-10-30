import { EmailLinkConfirm } from '@/features/workspace/passwordless-form';
export const metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
export default function Page() { return <div className="shell auth-page"><EmailLinkConfirm /></div>; }
