'use client';
import { create } from 'zustand';
import type { Actor } from '@/types/workspace';
export const useSessionState = create<{
  actor: Actor | null;
  loading: boolean;
  setActor: (actor: Actor | null) => void;
}>((set) => ({ actor: null, loading: true, setActor: (actor) => set({ actor, loading: false }) }));
