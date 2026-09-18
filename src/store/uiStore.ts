import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const AMOUNTS_HIDDEN_KEY = "amounts_hidden";

interface UIState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  /** When true, all naira figures across the app render as masked (privacy mode). */
  amountsHidden: boolean;
  setOnline: (status: boolean) => void;
  setSyncing: (status: boolean) => void;
  setPendingCount: (n: number) => void;
  toggleAmountsHidden: () => void;
  /** Restores the persisted preference on app launch. */
  loadAmountsHidden: () => Promise<void>;
}

export const useUIStore = create<UIState>((set, get) => ({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  amountsHidden: false,
  setOnline: (isOnline) => set({ isOnline }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  toggleAmountsHidden: () => {
    const next = !get().amountsHidden;
    set({ amountsHidden: next });
    SecureStore.setItemAsync(AMOUNTS_HIDDEN_KEY, next ? "true" : "false").catch(() => {});
  },
  loadAmountsHidden: async () => {
    try {
      const stored = await SecureStore.getItemAsync(AMOUNTS_HIDDEN_KEY);
      if (stored === "true") set({ amountsHidden: true });
    } catch {}
  },
}));
