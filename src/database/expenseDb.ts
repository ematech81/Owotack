import "react-native-get-random-values";
import { v4 as uuid } from "uuid";
import { getDb } from "./schema";
import { Expense } from "../types";

const nextYMD = (ymd: string): string => {
  const d = new Date(ymd.slice(0, 10) + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

type LocalExpenseRow = {
  id: string;
  server_id: string | null;
  user_id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  is_recurring: number;
  recurring_frequency: string;
  raw_input: string | null;
  sync_status: string;
  created_at: string;
  updated_at: string;
  is_deleted: number;
};

const rowToExpense = (row: LocalExpenseRow): Expense => ({
  _id: row.server_id || row.id,
  userId: row.user_id,
  date: row.date,
  description: row.description,
  amount: row.amount,
  category: row.category,
  isRecurring: row.is_recurring === 1,
  recurringFrequency: row.recurring_frequency as Expense["recurringFrequency"],
  syncStatus: row.sync_status as Expense["syncStatus"],
  localId: row.id,
  isDeleted: row.is_deleted === 1,
  createdAt: row.created_at,
});

export const expenseDb = {
  async insert(userId: string, data: {
    date: string;
    description: string;
    amount: number;
    category: string;
    isRecurring?: boolean;
    recurringFrequency?: string;
    rawInput?: string;
  }): Promise<Expense> {
    const db = await getDb();
    const id = uuid();
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO expenses
        (id, user_id, date, description, amount, category, is_recurring,
         recurring_frequency, raw_input, sync_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        id, userId, data.date, data.description, data.amount, data.category,
        data.isRecurring ? 1 : 0, data.recurringFrequency ?? "none",
        data.rawInput ?? null, now, now,
      ]
    );

    const row = await db.getFirstAsync<LocalExpenseRow>("SELECT * FROM expenses WHERE id = ?", [id]);
    return rowToExpense(row!);
  },

  async getByDate(userId: string, date: string): Promise<Expense[]> {
    const db = await getDb();
    const ymd = date.slice(0, 10);
    const rows = await db.getAllAsync<LocalExpenseRow>(
      "SELECT * FROM expenses WHERE user_id = ? AND date >= ? AND date < ? AND is_deleted = 0 ORDER BY created_at DESC",
      [userId, ymd, nextYMD(ymd)]
    );
    return rows.map(rowToExpense);
  },

  async getPending(): Promise<Expense[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<LocalExpenseRow>(
      "SELECT * FROM expenses WHERE sync_status = 'pending' AND is_deleted = 0"
    );
    return rows.map(rowToExpense);
  },

  async markSynced(localId: string, serverId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "UPDATE expenses SET server_id = ?, sync_status = 'synced', sync_attempts = 0, updated_at = ? WHERE id = ?",
      [serverId, new Date().toISOString(), localId]
    );
  },

  // Caps retries at 5 attempts — after that, mark 'failed' instead of staying
  // 'pending' forever, so a permanently-rejected record stops being retried on
  // every foreground/reconnect and can be surfaced to the user instead.
  async recordSyncFailure(localId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `UPDATE expenses
       SET sync_attempts = sync_attempts + 1,
           sync_status = CASE WHEN sync_attempts + 1 >= 5 THEN 'failed' ELSE 'pending' END,
           updated_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), localId]
    );
  },

  async getFailedCount(): Promise<number> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) as n FROM expenses WHERE sync_status = 'failed' AND is_deleted = 0"
    );
    return row?.n ?? 0;
  },

  async softDelete(localId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "UPDATE expenses SET is_deleted = 1, sync_status = 'pending', updated_at = ? WHERE id = ?",
      [new Date().toISOString(), localId]
    );
  },

  async getByDateRange(userId: string, startYMD: string, endYMD: string): Promise<Expense[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<LocalExpenseRow>(
      "SELECT * FROM expenses WHERE user_id = ? AND date >= ? AND date < ? AND is_deleted = 0 ORDER BY created_at DESC",
      [userId, startYMD, nextYMD(endYMD)]
    );
    return rows.map(rowToExpense);
  },

  async getRecent(userId: string, limit = 50): Promise<Expense[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<LocalExpenseRow>(
      "SELECT * FROM expenses WHERE user_id = ? AND is_deleted = 0 ORDER BY created_at DESC LIMIT ?",
      [userId, limit]
    );
    return rows.map(rowToExpense);
  },

  async upsertFromServer(userId: string, expenses: Expense[]): Promise<void> {
    const db = await getDb();
    for (const exp of expenses) {
      const serverId = exp._id;
      const existing = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM expenses WHERE server_id = ? AND user_id = ?",
        [serverId, userId]
      );
      if (!existing) {
        const id = exp.localId || uuid();
        const now = new Date().toISOString();
        await db.runAsync(
          `INSERT OR IGNORE INTO expenses
            (id, server_id, user_id, date, description, amount, category,
             is_recurring, recurring_frequency, raw_input, sync_status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)`,
          [
            id, serverId, userId,
            typeof exp.date === "string" ? exp.date : new Date(exp.date).toISOString(),
            exp.description, exp.amount, exp.category,
            exp.isRecurring ? 1 : 0,
            exp.recurringFrequency ?? "none",
            null,
            exp.createdAt || now, now,
          ]
        );
      }
    }
  },
};
