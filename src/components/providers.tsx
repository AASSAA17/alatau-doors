'use client';
import { useEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { useFavorites } from '@/store/favorites';
import { useSessionState } from '@/store/session';
import { useTranslations } from 'next-intl';
export function Providers({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Workspace');
  const error = useFavorites((s) => s.error);
  useEffect(() => {
    let disposed = false;
    async function init() {
      await useFavorites.persist.rehydrate();
      try {
        const response = await fetch('/api/workspace?resource=me', { cache: 'no-store' });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (disposed) return;
        useSessionState.getState().setActor(data.actor);
        useFavorites
          .getState()
          .connect(data.actor?.role === 'BUYER' ? data.actor.id : null, data.ids);
      } catch {
        if (!disposed) useSessionState.getState().setActor(null);
      }
    }
    void init();
    return () => {
      disposed = true;
    };
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      {error && (
        <div role="alert" className="global-alert">
          {t.has(`errors.${error}`) ? t(`errors.${error}`) : t('errors.SERVER_ERROR')}
        </div>
      )}
      {children}
    </MotionConfig>
  );
}
