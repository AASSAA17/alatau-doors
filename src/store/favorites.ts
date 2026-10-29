'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { workspaceRequest } from '@/lib/workspace-client';

type FavoritesState = {
  ids: string[];
  guestIds: string[];
  userId: string | null;
  busy: boolean;
  error: string;
  connect: (userId: string | null, ids: string[]) => void;
  toggle: (id: string) => Promise<void>;
  clear: () => Promise<void>;
};
export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      guestIds: [],
      userId: null,
      busy: false,
      error: '',
      connect: (userId, ids) =>
        set((state) => ({ userId, ids: userId ? ids : state.guestIds, error: '' })),
      toggle: async (id) => {
        const state = get();
        if (state.busy) return;
        const saved = !state.ids.includes(id);
        const ids = saved ? [...state.ids, id] : state.ids.filter((v) => v !== id);
        if (!state.userId) {
          set({ ids, guestIds: ids });
          return;
        }
        set({ busy: true, error: '' });
        try {
          const result = await workspaceRequest<{ ids: string[] }>({
            action: 'favorite',
            productId: id,
            saved,
          });
          set({ ids: result.ids });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : 'SERVER_ERROR' });
        } finally {
          set({ busy: false });
        }
      },
      clear: async () => {
        const state = get();
        if (state.busy) return;
        if (!state.userId) {
          set({ ids: [], guestIds: [] });
          return;
        }
        set({ busy: true, error: '' });
        try {
          await workspaceRequest({ action: 'clearFavorites' });
          set({ ids: [] });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : 'SERVER_ERROR' });
        } finally {
          set({ busy: false });
        }
      },
    }),
    {
      name: 'alatau-favorites-v1',
      version: 1,
      skipHydration: true,
      partialize: (state) => ({ guestIds: state.guestIds }),
      merge: (persisted, current) => {
        const stored = persisted as { ids?: unknown; guestIds?: unknown } | undefined;
        const ids = stored?.guestIds ?? stored?.ids;
        const guestIds = Array.isArray(ids)
          ? [...new Set(ids.filter((id): id is string => typeof id === 'string'))].slice(0, 100)
          : [];
        return {
          ...current,
          guestIds,
          ids: guestIds,
        };
      },
    },
  ),
);
