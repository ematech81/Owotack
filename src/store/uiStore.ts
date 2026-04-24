import { create } from "zustand";

interface UIState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  setOnline: (status: boolean) => void;
  setSyncing: (status: boolean) => void;
  setPendingCount: (n: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  setOnline: (isOnline) => set({ isOnline }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
}));
