import { salesDb } from "../database/salesDb";
import { expenseDb } from "../database/expenseDb";
import api from "./api";
import { ApiResponse, Sale, Expense } from "../types";

export const syncService = {
  async getPendingCount(): Promise<number> {
    const [sales, expenses] = await Promise.all([
      salesDb.getPending(),
      expenseDb.getPending(),
    ]);
    return sales.length + expenses.length;
  },

  async syncPending(): Promise<{ sales: number; expenses: number }> {
    let salesSynced = 0;
    let expensesSynced = 0;

    const [pendingSales, pendingExpenses] = await Promise.all([
      salesDb.getPending(),
      expenseDb.getPending(),
    ]);

    for (const sale of pendingSales) {
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
        await salesDb.markSynced(sale.localId!, res.data.data._id);
        salesSynced++;
      } catch { /* stay pending, retry next time */ }
    }

    for (const expense of pendingExpenses) {
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
        await expenseDb.markSynced(expense.localId!, res.data.data._id);
        expensesSynced++;
      } catch { /* stay pending, retry next time */ }
    }

    return { sales: salesSynced, expenses: expensesSynced };
  },
};
