import { create } from "zustand";
import { stockService, IStockItem, StockStats } from "../services/stockService";

function computeStats(items: IStockItem[]): StockStats {
  return {
    totalValue: items.reduce((s, i) => s + i.qty * (i.costPrice || i.sellingPrice), 0),
    lowCount: items.filter((i) => i.qty > 0 && i.qty <= (i.lowStockThreshold ?? 5)).length,
    outCount: items.filter((i) => i.qty === 0).length,
    totalItems: items.length,
  };
}

interface StockState {
  items: IStockItem[];
  stats: StockStats | null;
  isLoading: boolean;
  search: string;

  loadItems: () => Promise<void>;
  addItem: (data: Partial<IStockItem>) => Promise<void>;
  updateItem: (id: string, data: Partial<IStockItem>) => Promise<void>;
  adjustQty: (id: string, delta: number) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  setSearch: (q: string) => void;
}

export const useStockStore = create<StockState>((set, get) => ({
  items: [],
  stats: null,
  isLoading: false,
  search: "",

  // Always loads ALL items — filtering is done client-side so stats are
  // always computed from the full dataset, not a filtered subset.
  loadItems: async () => {
    set({ isLoading: true });
    try {
      const items = await stockService.list({});
      set({ items, stats: computeStats(items) });
    } finally {
      set({ isLoading: false });
    }
  },

  addItem: async (data) => {
    const item = await stockService.create(data);
    set((s) => {
      const items = [item, ...s.items];
      return { items, stats: computeStats(items) };
    });
  },

  updateItem: async (id, data) => {
    const updated = await stockService.update(id, data);
    set((s) => {
      const items = s.items.map((i) => (i._id === id ? updated : i));
      return { items, stats: computeStats(items) };
    });
  },

  adjustQty: async (id, delta) => {
    const updated = await stockService.adjustQty(id, delta);
    set((s) => {
      const items = s.items.map((i) => (i._id === id ? updated : i));
      return { items, stats: computeStats(items) };
    });
  },

  deleteItem: async (id) => {
    await stockService.delete(id);
    set((s) => {
      const items = s.items.filter((i) => i._id !== id);
      return { items, stats: computeStats(items) };
    });
  },

  // Only updates the search string — the component derives filteredItems locally.
  setSearch: (search) => {
    set({ search });
  },
}));
