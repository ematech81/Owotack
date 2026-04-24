import { create } from "zustand";
import { Sale, SaleItem } from "../types";
import { salesDb } from "../database/salesDb";
import api from "../services/api";
import { ApiResponse } from "../types";
import { useUIStore } from "./uiStore";

interface SalesState {
  todaySales: Sale[];
  isLoading: boolean;
  addSale: (data: {
    date: string;
    items: SaleItem[];
    paymentType: string;
    inputMethod: string;
    rawInput?: string;
    notes?: string;
    customerName?: string;
    userId: string;
  }) => Promise<Sale>;
  loadToday: (userId: string) => Promise<void>;
  parseText: (input: string) => Promise<unknown>;
}

const computeTotals = (items: SaleItem[]) => {
  const totalAmount = items.reduce((s, i) => s + (i.unitPrice * i.quantity), 0);
  const totalCostOfGoods = items.reduce((s, i) => s + ((i.costPrice ?? 0) * i.quantity), 0);
  const totalProfit = totalAmount - totalCostOfGoods;
  const profitMargin = totalAmount > 0 ? Math.round((totalProfit / totalAmount) * 1000) / 10 : 0;
  return { totalAmount, totalCostOfGoods, totalProfit, profitMargin };
};

export const useSalesStore = create<SalesState>((set) => ({
  todaySales: [],
  isLoading: false,

  addSale: async (data) => {
    const { isOnline } = useUIStore.getState();
    const totals = computeTotals(data.items);

    const items: SaleItem[] = data.items.map((item) => ({
      ...item,
      totalAmount: item.unitPrice * item.quantity,
      profit: (item.unitPrice - (item.costPrice ?? 0)) * item.quantity,
    }));

    const localSale = await salesDb.insert(data.userId, { ...data, ...totals, items });

    set((state) => ({ todaySales: [localSale, ...state.todaySales] }));

    if (isOnline) {
      try {
        const res = await api.post<ApiResponse<Sale>>("/sales", {
          date: data.date,
          items: data.items,
          paymentType: data.paymentType,
          inputMethod: data.inputMethod,
          rawInput: data.rawInput,
          notes: data.notes,
          localId: localSale.localId,
        });
        await salesDb.markSynced(localSale.localId!, res.data.data._id);
      } catch {
        // Will sync later via background sync
      }
    }

    return localSale;
  },

  loadToday: async (userId) => {
    set({ isLoading: true });
    try {
      const today = new Date().toISOString().split("T")[0];
      // Load local first for instant display
      const localSales = await salesDb.getByDate(userId, today);
      set({ todaySales: localSales });

      // Sync from server if online
      const { isOnline } = useUIStore.getState();
      if (isOnline) {
        try {
          const res = await api.get<ApiResponse<Sale[]>>("/sales", {
            params: { startDate: `${today}T00:00:00.000Z`, endDate: `${today}T23:59:59.999Z`, limit: 100 },
          });
          await salesDb.upsertFromServer(userId, res.data.data);
          const synced = await salesDb.getByDate(userId, today);
          set({ todaySales: synced });
        } catch { /* use local data on network failure */ }
      }
    } finally {
      set({ isLoading: false });
    }
  },

  parseText: async (input: string) => {
    const res = await api.post<ApiResponse<unknown>>("/sales/parse-text", { input });
    return res.data.data;
  },
}));
