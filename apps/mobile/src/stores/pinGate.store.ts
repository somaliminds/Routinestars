/**
 * Tiny store so any child-app screen can request the PIN gate modal,
 * while the modal itself stays mounted at the layout level.
 */
import { create } from 'zustand';

interface PinGateState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const usePinGate = create<PinGateState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
