import { auth } from '@/lib/server/auth';
import { ensureDatabaseMode, getDb } from '@/lib/server/db';
import { accountSecurityRequired, staffRole } from '@/lib/server/auth-policy';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  await ensureDatabaseMode();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ signedIn: false }, { headers: { 'Cache-Control': 'no-store' } });
  const user = await getDb().prepare('SELECT role,active,emailVerified,phoneNumberVerified,twoFactorEnabled FROM user WHERE id=?').get(session.user.id) as
    { role: string; active: boolean; emailVerified: boolean; phoneNumberVerified: boolean; twoFactorEnabled: boolean } | undefined;
  if (!user?.active) return Response.json({ signedIn: false }, { headers: { 'Cache-Control': 'no-store' } });
  return Response.json({ signedIn: true, role: user.role, emailVerified: Boolean(user.emailVerified), emailRequired: accountSecurityRequired && !(user.role === 'BUYER' && user.phoneNumberVerified),
    enabled: Boolean(user.twoFactorEnabled), required: accountSecurityRequired && staffRole(user.role),
    verified: Boolean(session.session.mfaVerified) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
