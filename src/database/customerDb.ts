import "react-native-get-random-values";
import { v4 as uuid } from "uuid";
import { getDb } from "./schema";
import { Customer } from "../types";

type LocalCustomerRow = {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  is_deleted: number;
};

const rowToCustomer = (row: LocalCustomerRow): Customer => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  phone: row.phone ?? undefined,
  address: row.address ?? undefined,
  notes: row.notes ?? undefined,
  isActive: row.is_active === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const customerDb = {
  async insert(userId: string, data: {
    name: string;
    phone?: string;
    address?: string;
    notes?: string;
  }): Promise<Customer> {
    const db = await getDb();
    const id = uuid();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO customers (id, user_id, name, phone, address, notes, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id, userId, data.name.trim(),
        data.phone?.trim() || null,
        data.address?.trim() || null,
        data.notes?.trim() || null,
        now, now,
      ]
    );
    const row = await db.getFirstAsync<LocalCustomerRow>("SELECT * FROM customers WHERE id = ?", [id]);
    return rowToCustomer(row!);
  },

  async getAll(userId: string): Promise<Customer[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<LocalCustomerRow>(
      "SELECT * FROM customers WHERE user_id = ? AND is_deleted = 0 ORDER BY name ASC",
      [userId]
    );
    return rows.map(rowToCustomer);
  },

  async getActive(userId: string): Promise<Customer[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<LocalCustomerRow>(
      "SELECT * FROM customers WHERE user_id = ? AND is_active = 1 AND is_deleted = 0 ORDER BY name ASC",
      [userId]
    );
    return rows.map(rowToCustomer);
  },

  async update(id: string, data: {
    name: string;
    phone?: string;
    address?: string;
    notes?: string;
  }): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "UPDATE customers SET name = ?, phone = ?, address = ?, notes = ?, updated_at = ? WHERE id = ?",
      [
        data.name.trim(),
        data.phone?.trim() || null,
        data.address?.trim() || null,
        data.notes?.trim() || null,
        new Date().toISOString(),
        id,
      ]
    );
  },

  async setActive(id: string, isActive: boolean): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "UPDATE customers SET is_active = ?, updated_at = ? WHERE id = ?",
      [isActive ? 1 : 0, new Date().toISOString(), id]
    );
  },

  async softDelete(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "UPDATE customers SET is_deleted = 1, updated_at = ? WHERE id = ?",
      [new Date().toISOString(), id]
    );
  },

  // Finds existing customer by name (case-insensitive) or creates a new one.
  // Used to seed the table when a sale/credit is saved with a customer name.
  async upsertByName(userId: string, name: string): Promise<Customer> {
    const db = await getDb();
    const normalized = name.trim();
    const existing = await db.getFirstAsync<LocalCustomerRow>(
      "SELECT * FROM customers WHERE user_id = ? AND LOWER(name) = LOWER(?) AND is_deleted = 0",
      [userId, normalized]
    );
    if (existing) return rowToCustomer(existing);
    return customerDb.insert(userId, { name: normalized });
  },

  // Bulk-seed customers from a list of names (e.g. migrating from AsyncStorage).
  // Skips names that already exist in the table.
  async seedFromNames(userId: string, names: string[]): Promise<void> {
    for (const name of names) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      const db = await getDb();
      const existing = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM customers WHERE user_id = ? AND LOWER(name) = LOWER(?) AND is_deleted = 0",
        [userId, trimmed]
      );
      if (!existing) {
        await customerDb.insert(userId, { name: trimmed });
      }
    }
  },
};
