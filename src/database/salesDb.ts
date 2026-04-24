import "react-native-get-random-values";
import { v4 as uuid } from "uuid";
import { getDb } from "./schema";
import { Sale, SaleItem } from "../types";

// Returns the next calendar day as YYYY-MM-DD. Used for exclusive upper-bound queries so that
// both date-only ("2024-04-20") and full-timestamp ("2024-04-20T10:30:00.000Z") formats are matched.
const nextYMD = (ymd: string): string => {
  const d = new Date(ymd.slice(0, 10) + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

type LocalSaleRow = {
  id: string;
  server_id: string | null;
  user_id: string;
  date: string;
  items: string;
  total_amount: number;
  total_cost_of_goods: number;
  total_profit: number;
  profit_margin: number;
  payment_type: string;
  input_method: string;
  raw_input: string | null;
  notes: string | null;
  customer_name: string | null;
  sync_status: string;
  created_at: string;
  updated_at: string;
  is_deleted: number;
};

const rowToSale = (row: LocalSaleRow): Sale => ({
  _id: row.server_id || row.id,
  userId: row.user_id,
  date: row.date,
  items: JSON.parse(row.items) as SaleItem[],
  totalAmount: row.total_amount,
  totalCostOfGoods: row.total_cost_of_goods,
  totalProfit: row.total_profit,
  profitMargin: row.profit_margin,
  paymentType: row.payment_type as Sale["paymentType"],
  inputMethod: row.input_method as Sale["inputMethod"],
  rawInput: row.raw_input ?? undefined,
  notes: row.notes ?? undefined,
  customerName: row.customer_name ?? undefined,
  syncStatus: row.sync_status as Sale["syncStatus"],
  localId: row.id,
  isDeleted: row.is_deleted === 1,
  createdAt: row.created_at,
});

export const salesDb = {
  async insert(userId: string, data: {
    date: string;
    items: SaleItem[];
    totalAmount: number;
    totalCostOfGoods: number;
    totalProfit: number;
    profitMargin: number;
    paymentType: string;
    inputMethod: string;
    rawInput?: string;
    notes?: string;
    customerName?: string;
  }): Promise<Sale> {
    const db = await getDb();
    const id = uuid();
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO sales
        (id, user_id, date, items, total_amount, total_cost_of_goods, total_profit,
         profit_margin, payment_type, input_method, raw_input, notes, customer_name,
         sync_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        id, userId, data.date, JSON.stringify(data.items),
        data.totalAmount, data.totalCostOfGoods, data.totalProfit,
        data.profitMargin, data.paymentType, data.inputMethod,
        data.rawInput ?? null, data.notes ?? null, data.customerName ?? null, now, now,
      ]
    );

    const row = await db.getFirstAsync<LocalSaleRow>("SELECT * FROM sales WHERE id = ?", [id]);
    return rowToSale(row!);
  },

  async getByDate(userId: string, date: string): Promise<Sale[]> {
    const db = await getDb();
    const ymd = date.slice(0, 10);
    const nextDay = nextYMD(ymd);
    const rows = await db.getAllAsync<LocalSaleRow>(
      "SELECT * FROM sales WHERE user_id = ? AND date >= ? AND date < ? AND is_deleted = 0 ORDER BY created_at DESC",
      [userId, ymd, nextDay]
    );
    return rows.map(rowToSale);
  },

  async getPending(): Promise<Sale[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<LocalSaleRow>(
      "SELECT * FROM sales WHERE sync_status = 'pending' AND is_deleted = 0"
    );
    return rows.map(rowToSale);
  },

  async markSynced(localId: string, serverId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "UPDATE sales SET server_id = ?, sync_status = 'synced', updated_at = ? WHERE id = ?",
      [serverId, new Date().toISOString(), localId]
    );
  },

  async softDelete(localId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "UPDATE sales SET is_deleted = 1, sync_status = 'pending', updated_at = ? WHERE id = ?",
      [new Date().toISOString(), localId]
    );
  },

  async getByDateRange(userId: string, startYMD: string, endYMD: string): Promise<Sale[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<LocalSaleRow>(
      "SELECT * FROM sales WHERE user_id = ? AND date >= ? AND date < ? AND is_deleted = 0 ORDER BY created_at DESC",
      [userId, startYMD, nextYMD(endYMD)]
    );
    return rows.map(rowToSale);
  },

  async getRecent(userId: string, limit = 50): Promise<Sale[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<LocalSaleRow>(
      "SELECT * FROM sales WHERE user_id = ? AND is_deleted = 0 ORDER BY created_at DESC LIMIT ?",
      [userId, limit]
    );
    return rows.map(rowToSale);
  },

  async upsertFromServer(userId: string, sales: Sale[]): Promise<void> {
    const db = await getDb();
    for (const sale of sales) {
      const serverId = sale._id;
      const existing = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM sales WHERE server_id = ? AND user_id = ?",
        [serverId, userId]
      );
      if (!existing) {
        const id = sale.localId || uuid();
        const now = new Date().toISOString();
        await db.runAsync(
          `INSERT OR IGNORE INTO sales
            (id, server_id, user_id, date, items, total_amount, total_cost_of_goods, total_profit,
             profit_margin, payment_type, input_method, raw_input, notes, sync_status,
             created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)`,
          [
            id, serverId, userId,
            typeof sale.date === "string" ? sale.date : new Date(sale.date).toISOString(),
            JSON.stringify(sale.items),
            sale.totalAmount, sale.totalCostOfGoods, sale.totalProfit, sale.profitMargin,
            sale.paymentType, sale.inputMethod, sale.rawInput ?? null, sale.notes ?? null,
            sale.createdAt || now, now,
          ]
        );
      }
    }
  },
};
