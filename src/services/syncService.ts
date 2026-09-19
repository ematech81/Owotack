import { salesDb } from "../database/salesDb";
import { expenseDb } from "../database/expenseDb";
import api from "./api";
import { ApiResponse, Sale, Expense } from "../types";

// Guards against double-syncing the same record: a sale/expense's own save-time
// inline POST (salesStore/expenseStore addSale/addExpense) and a background
// syncPending() run (reconnect or app-foreground) can otherwise both pick up the
// same still-pending localId and POST it twice. Both paths check/reserve here first.
const inFlight = new Set<string>();
export const isSyncInFlight = (localId: string): boolean => inFlight.has(localId);
export const markSyncInFlight = (localId: string): void => { inFlight.add(localId); };
export const clearSyncInFlight = (localId: string): void => { inFlight.delete(localId); };

export const syncService = {
  async getPendingCount(): Promise<number> {
    const [sales, expenses] = await Promise.all([
      salesDb.getPending(),
      expenseDb.getPending(),
    ]);
    return sales.length + expenses.length;
  },

  async getFailedCount(): Promise<number> {
    const [sales, expenses] = await Promise.all([
      salesDb.getFailedCount(),
      expenseDb.getFailedCount(),
    ]);
    return sales + expenses;
  },

  async syncPending(): Promise<{ sales: number; expenses: number }> {
    let salesSynced = 0;
    let expensesSynced = 0;

    const [pendingSales, pendingExpenses] = await Promise.all([
      salesDb.getPending(),
      expenseDb.getPending(),
    ]);

    for (const sale of pendingSales) {
      if (!sale.localId || isSyncInFlight(sale.localId)) continue; // being synced elsewhere already
      markSyncInFlight(sale.localId);
      try {
        const res = await api.post<ApiResponse<Sale>>("/sales", {
          date: sale.date,
          items: sale.items,
          paymentType: sale.paymentType,
          inputMethod: sale.inputMethod,
          rawInput: sale.rawInput,
          notes: sale.notes,
          customerName: sale.customerName,
          localId: sale.localId,
        });
        await salesDb.markSynced(sale.localId, res.data.data._id);
        salesSynced++;
      } catch {
        await salesDb.recordSyncFailure(sale.localId).catch(() => {});
      } finally {
        clearSyncInFlight(sale.localId);
      }
    }

    for (const expense of pendingExpenses) {
      if (!expense.localId || isSyncInFlight(expense.localId)) continue;
      markSyncInFlight(expense.localId);
      try {
        const res = await api.post<ApiResponse<Expense>>("/expenses", {
          date: expense.date,
          description: expense.description,
          amount: expense.amount,
          category: expense.category,
          isRecurring: expense.isRecurring,
          recurringFrequency: expense.recurringFrequency,
          localId: expense.localId,
        });
        await expenseDb.markSynced(expense.localId, res.data.data._id);
        expensesSynced++;
      } catch {
        await expenseDb.recordSyncFailure(expense.localId).catch(() => {});
      } finally {
        clearSyncInFlight(expense.localId);
      }
    }

    return { sales: salesSynced, expenses: expensesSynced };
  },
};
