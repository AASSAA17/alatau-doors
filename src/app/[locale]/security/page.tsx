import { MfaSecurity } from '@/features/workspace/mfa-security';
export default async function Page({searchParams}:{searchParams:Promise<{challenge?:string}>}) {
  return <div className="shell auth-page"><MfaSecurity challenge={(await searchParams).challenge === '1'}/></div>;
}
