import { create } from 'zustand';
import type { ChildProfileRow } from '@/types/database';

interface ChildState {
  /** The currently active child profile (set after profile selection). */
  selectedChild: ChildProfileRow | null;
  setSelectedChild: (profile: ChildProfileRow) => void;
  clearSelectedChild: () => void;
}

export const useChildStore = create<ChildState>((set) => ({
  selectedChild: null,
  setSelectedChild: (profile) => set({ selectedChild: profile }),
  clearSelectedChild: () => set({ selectedChild: null }),
}));
