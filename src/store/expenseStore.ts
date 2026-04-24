import { create } from "zustand";
import { Expense } from "../types";
import { expenseDb } from "../database/expenseDb";
import api from "../services/api";
import { ApiResponse } from "../types";
import { useUIStore } from "./uiStore";

interface ExpenseState {
  todayExpenses: Expense[];
  isLoading: boolean;
  addExpense: (data: {
    date: string;
    description: string;
    amount: number;
    category: string;
    isRecurring?: boolean;
    recurringFrequency?: string;
    rawInput?: string;
    userId: string;
  }) => Promise<Expense>;
  loadToday: (userId: string) => Promise<void>;
  parseText: (input: string) => Promise<unknown>;
}

export const useExpenseStore = create<ExpenseState>((set) => ({
  todayExpenses: [],
  isLoading: false,

  addExpense: async (data) => {
    const { isOnline } = useUIStore.getState();

    const localExpense = await expenseDb.insert(data.userId, data);
    set((state) => ({ todayExpenses: [localExpense, ...state.todayExpenses] }));

    if (isOnline) {
      try {
        const res = await api.post<ApiResponse<Expense>>("/expenses", {
          date: data.date,
          description: data.description,
          amount: data.amount,
          category: data.category,
          isRecurring: data.isRecurring ?? false,
          recurringFrequency: data.recurringFrequency ?? "none",
          rawInput: data.rawInput,
          localId: localExpense.localId,
        });
        await expenseDb.markSynced(localExpense.localId!, res.data.data._id);
      } catch {
        // Will sync later
      }
    }

    return localExpense;
  },

  loadToday: async (userId) => {
    set({ isLoading: true });
    try {
      const today = new Date().toISOString().split("T")[0];
      // Load local first for instant display
      const localExpenses = await expenseDb.getByDate(userId, today);
      set({ todayExpenses: localExpenses });

      // Sync from server if online
      const { isOnline } = useUIStore.getState();
      if (isOnline) {
        try {
          const res = await api.get<ApiResponse<Expense[]>>("/expenses", {
            params: { startDate: `${today}T00:00:00.000Z`, endDate: `${today}T23:59:59.999Z`, limit: 100 },
          });
          await expenseDb.upsertFromServer(userId, res.data.data);
          const synced = await expenseDb.getByDate(userId, today);
          set({ todayExpenses: synced });
        } catch { /* use local data on network failure */ }
      }
    } finally {
      set({ isLoading: false });
    }
  },

  parseText: async (input: string) => {
    const res = await api.post<ApiResponse<unknown>>("/expenses/parse-text", { input });
    return res.data.data;
  },
}));
