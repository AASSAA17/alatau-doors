import { auth } from './auth';
import { getDb, ensureDatabaseMode } from './db';
import type { Actor, Role } from '@/types/workspace';
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
    .prepare('SELECT id,name,email,role,phone,active FROM user WHERE id = ?')
    .get(session.user.id)) as Actor | undefined;
  if (!user || !user.active) return null;
  return { ...user, active: Boolean(user.active), phone: user.phone || '' };
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
