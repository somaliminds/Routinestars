/**
 * useParentStore — Sprint 3.1
 * Global state for the parent app: which child the parent is currently viewing.
 */
import { create } from 'zustand';
import type { ChildProfileRow } from '@/types/database';

interface ParentState {
  /** The child profile the parent is currently viewing/managing */
  activeChild: ChildProfileRow | null;
  setActiveChild: (child: ChildProfileRow) => void;
  clearActiveChild: () => void;
}

export const useParentStore = create<ParentState>((set) => ({
  activeChild: null,
  setActiveChild: (child) => set({ activeChild: child }),
  clearActiveChild: () => set({ activeChild: null }),
}));
