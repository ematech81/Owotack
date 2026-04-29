import { create } from "zustand";
import { Sale, SaleItem } from "../types";
import { salesDb } from "../database/salesDb";
import api from "../services/api";
import { ApiResponse } from "../types";
import { useUIStore } from "./uiStore";
import { generateInvoiceNumber } from "../utils/invoiceNumber";

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
    discount?: number;
    discountType?: "fixed" | "percent";
    tax?: number;
    userId: string;
  }) => Promise<Sale>;
  loadToday: (userId: string) => Promise<void>;
  parseText: (input: string) => Promise<unknown>;
}

function computeTotals(
  items: SaleItem[],
  discount = 0,
  discountType: "fixed" | "percent" = "fixed",
  tax = 0
) {
  const subtotal = items.reduce((s, i) => s + (i.unitPrice * i.quantity), 0);
  const totalCostOfGoods = items.reduce((s, i) => s + ((i.costPrice ?? 0) * i.quantity), 0);
  const discountAmount = discountType === "percent"
    ? subtotal * discount / 100
    : Math.min(discount, subtotal);
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const taxAmount = afterDiscount * tax / 100;
  const totalAmount = afterDiscount + taxAmount;
  const totalProfit = afterDiscount - totalCostOfGoods;
  const profitMargin = subtotal > 0 ? Math.round((totalProfit / subtotal) * 1000) / 10 : 0;
  return { subtotal, discountAmount, taxAmount, totalAmount, totalCostOfGoods, totalProfit, profitMargin };
}

export const useSalesStore = create<SalesState>((set) => ({
  todaySales: [],
  isLoading: false,

  addSale: async (data) => {
    const { isOnline } = useUIStore.getState();

    const items: SaleItem[] = data.items.map((item) => ({
      ...item,
      totalAmount: item.unitPrice * item.quantity,
      profit: (item.unitPrice - (item.costPrice ?? 0)) * item.quantity,
    }));

    const totals = computeTotals(items, data.discount, data.discountType, data.tax);
    const invoiceNumber = await generateInvoiceNumber(data.userId);

    const localSale = await salesDb.insert(data.userId, {
      ...data,
      ...totals,
      items,
      invoiceNumber,
      discount: data.discount ?? 0,
      discountType: data.discountType ?? "fixed",
      tax: data.tax ?? 0,
    });

    // Immediately re-read today's sales from SQLite so the home screen
    // sees correct data as soon as it gains focus.
    const today = new Date().toISOString().split("T")[0];
    const refreshed = await salesDb.getByDate(data.userId, today);
    set({ todaySales: refreshed });

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
          customerName: data.customerName,
          invoiceNumber,
          discount: data.discount ?? 0,
          discountType: data.discountType ?? "fixed",
          tax: data.tax ?? 0,
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

      // Always read local first
      const localSales = await salesDb.getByDate(userId, today);
      set({ todaySales: localSales });

      // Sync last 30 days from server so ledger + week/month views all have data
      const { isOnline } = useUIStore.getState();
      if (isOnline) {
        try {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const startDate = thirtyDaysAgo.toISOString().split("T")[0];
          const res = await api.get<ApiResponse<Sale[]>>("/sales", {
            params: { startDate: `${startDate}T00:00:00.000Z`, endDate: `${today}T23:59:59.999Z`, limit: 100 },
          });
          await salesDb.upsertFromServer(userId, res.data.data);
          const synced = await salesDb.getByDate(userId, today);
          set({ todaySales: synced });
        } catch {
          // Network or sync error — local data already set above, no action needed
        }
      }
    } catch (err) {
      // Local DB read failed — log but don't crash; todaySales stays as-is
      console.warn("[salesStore] loadToday failed:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  parseText: async (input: string) => {
    const res = await api.post<ApiResponse<unknown>>("/sales/parse-text", { input });
    return res.data.data;
  },
}));
