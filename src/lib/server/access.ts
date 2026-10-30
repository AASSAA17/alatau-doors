import { auth } from './auth';
import { getDb, ensureDatabaseMode } from './db';
import type { Actor, Role } from '@/types/workspace';
import { accountSecurityRequired, staffRole } from './auth-policy';
export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export function fail(code: string, status = 400): never {
  throw new AppError(code, status);
}
export async function getActor(headers: Headers): Promise<Actor | null> {
  await ensureDatabaseMode();
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const user = (await getDb()
    .prepare('SELECT id,name,email,role,phone,active,emailVerified,phoneNumberVerified,twoFactorEnabled FROM user WHERE id = ?')
    .get(session.user.id)) as (Actor & {emailVerified: boolean; phoneNumberVerified: boolean; twoFactorEnabled: boolean}) | undefined;
  if (!user || !user.active) return null;
  if (accountSecurityRequired && !user.emailVerified && !(user.role === 'BUYER' && user.phoneNumberVerified)) fail('EMAIL_NOT_VERIFIED', 403);
  if (accountSecurityRequired && staffRole(user.role) && (!user.twoFactorEnabled || !session.session.mfaVerified))
    fail('MFA_REQUIRED', 403);
  return { id: user.id, name: user.name, email: user.email, role: user.role, active: Boolean(user.active), phone: user.phone || '' };
}
export async function requireActor(headers: Headers, roles?: Role[]) {
  const actor = await getActor(headers);
  if (!actor) fail('UNAUTHORIZED', 401);
  if (roles && !roles.includes(actor.role)) fail('FORBIDDEN', 403);
  return actor;
}
export function requireRole(actor: Actor, roles: Role[]) {
  if (!roles.includes(actor.role)) fail('FORBIDDEN', 403);
}
