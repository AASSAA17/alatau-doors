import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AppError, getActor } from '@/lib/server/access';
import { WorkspaceNavigation } from './navigation';
import type { Actor, Role } from '@/types/workspace';
import { SignOutButton } from './shared';
export async function optionalPageActor(locale: string) {
  let actor;
  try { actor = await getActor(await headers()); }
  catch (error) {
    if (error instanceof AppError && error.code === 'MFA_REQUIRED') redirect(`/${locale}/security`);
    if (error instanceof AppError && error.code === 'EMAIL_NOT_VERIFIED') redirect(`/${locale}/verify-email`);
    throw error;
  }
  return actor;
}
export async function pageActor(locale: string, roles?: Role[]) {
  const actor = await optionalPageActor(locale);
  if (!actor) redirect(`/${locale}/sign-in`);
  if (roles && !roles.includes(actor.role)) notFound();
  return actor;
}
export async function WorkspaceShell({
  actor,
  children,
}: {
  actor: Actor;
  children: React.ReactNode;
}) {
  const t = await getTranslations('Workspace');
  const root = actor.role === 'ADMIN' ? '/admin' : actor.role === 'SELLER' ? '/seller' : '/account';
  const links =
    actor.role === 'ADMIN'
      ? [
          [root, 'requests'],
          ['/admin/products', 'products'],
          ['/admin/users', 'users'],
          ['/admin/settings', 'settings'],
          ['/account/profile', 'profile'],
        ]
      : actor.role === 'SELLER'
        ? [
            [root, 'requests'],
            ['/account/profile', 'profile'],
          ]
        : [
            [root, 'requests'],
            ['/selection', 'selection'],
            ['/favorites', 'favorites'],
            ['/account/profile', 'profile'],
          ];
  return (
    <div className="shell workspace-layout">
      <aside className="workspace-sidebar">
        <p className="eyebrow">{t(`roles.${actor.role}`)}</p>
        <p className="workspace-person">{actor.name}</p>
        <WorkspaceNavigation links={links}/>
        <SignOutButton />
      </aside>
      <div className="workspace-main">{children}</div>
    </div>
  );
}
