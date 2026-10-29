import { AuthForm } from '@/features/workspace/auth-form';
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
      <AuthForm returnToSelection={returnTo === 'selection'} />
    </div>
  );
}
