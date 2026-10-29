'use client';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFavorites } from '@/store/favorites';
import { cn } from '@/lib/utils';
import { useSessionState } from '@/store/session';
export function FavoriteButton({ id, className }: { id: string; className?: string }) {
  const t = useTranslations('Common');
  const loading=useSessionState(s=>s.loading);const actor=useSessionState(s=>s.actor);const busy=useFavorites(s=>s.busy);
  const active = useFavorites((state) => state.ids.includes(id));
  const toggle = useFavorites((state) => state.toggle);
  return (
    <button
      type="button"
      disabled={loading||busy||Boolean(actor&&actor.role!=='BUYER')}
      className={cn('favorite-button', active && 'is-active', className)}
      onClick={() => toggle(id)}
      aria-label={t(active ? 'removeFavorite' : 'addFavorite')}
      aria-pressed={active}
    >
      <Heart size={19} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}
