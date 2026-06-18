/**
 * Tiny store so any child-app screen can request the PIN gate modal,
 * while the modal itself stays mounted at the layout level.
 *
 * Sprint 5.3 (device lock): also tracks `requireOnResume` — set TRUE
 * when the app goes to background while in child mode, so the next
 * attempt to enter parent area is gated even if the parent had
 * just authenticated.
 */
import { create } from 'zustand';

interface PinGateState {
  isOpen: boolean;
  /** True if the next "switch to parent" must show the PIN modal,
   *  regardless of recent successful auth. Set by the AppState
   *  listener when the app returns to foreground. */
  requireOnResume: boolean;
  open: () => void;
  close: () => void;
  markRequireOnResume: () => void;
  clearRequireOnResume: () => void;
}

export const usePinGate = create<PinGateState>((set) => ({
  isOpen: false,
  requireOnResume: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, requireOnResume: false }),
  markRequireOnResume: () => set({ requireOnResume: true }),
  clearRequireOnResume: () => set({ requireOnResume: false }),
}));
