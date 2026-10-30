'use client';
import { useSessionState } from '@/store/session';
import { useFavorites } from '@/store/favorites';
export async function authDestination(selection = false) {
  const response = await fetch('/api/workspace?resource=me', { cache: 'no-store' });
  const me = await response.json();
  if (['MFA_REQUIRED', 'EMAIL_NOT_VERIFIED'].includes(me.code)) {
    useSessionState.getState().setActor(null);
    useFavorites.getState().connect(null, []);
    return me.code === 'MFA_REQUIRED' ? '/security' : '/verify-email';
  }
  if (!response.ok || !me.actor) throw new Error('AUTH_FAILED');
  useSessionState.getState().setActor(me.actor);
  useFavorites.getState().connect(me.actor.role === 'BUYER' ? me.actor.id : null, me.ids);
  return me.actor.role === 'ADMIN' ? '/admin' : me.actor.role === 'SELLER' ? '/seller' : selection ? '/selection' : '/account';
}
