import { create } from "zustand";
import { creditService, ICredit, CreditStats } from "../services/creditService";

interface CreditState {
  credits: ICredit[];
  stats: CreditStats | null;
  isLoading: boolean;
  activeFilter: "all" | "overdue" | "due_soon" | "paid";

  loadCredits: (filter?: string) => Promise<void>;
  loadStats: () => Promise<void>;
  addCredit: (data: Partial<ICredit>) => Promise<void>;
  recordPayment: (id: string, amount: number, note?: string) => Promise<void>;
  deleteCredit: (id: string) => Promise<void>;
  setFilter: (f: CreditState["activeFilter"]) => void;
}

export const useCreditStore = create<CreditState>((set, get) => ({
  credits: [],
  stats: null,
  isLoading: false,
  activeFilter: "all",

  loadCredits: async (filter) => {
    set({ isLoading: true });
    try {
      const credits = await creditService.list(filter ?? get().activeFilter);
      set({ credits });
    } finally {
      set({ isLoading: false });
    }
  },

  loadStats: async () => {
    try {
      const stats = await creditService.getStats();
      set({ stats });
    } catch { /* silent */ }
  },

  addCredit: async (data) => {
    const credit = await creditService.create(data);
    set((s) => ({ credits: [credit, ...s.credits] }));
    get().loadStats();
  },

  recordPayment: async (id, amount, note) => {
    const updated = await creditService.recordPayment(id, amount, note);
    set((s) => ({
      credits: s.credits.map((c) => (c._id === id ? updated : c)),
    }));
    get().loadStats();
  },

  deleteCredit: async (id) => {
    await creditService.delete(id);
    set((s) => ({ credits: s.credits.filter((c) => c._id !== id) }));
    get().loadStats();
  },

  setFilter: (activeFilter) => {
    set({ activeFilter });
    get().loadCredits(activeFilter);
  },
}));
