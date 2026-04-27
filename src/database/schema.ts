import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) db = await SQLite.openDatabaseAsync("owotrack.db");
  return db;
};

export const initDatabase = async (): Promise<void> => {
  const database = await getDb();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      items TEXT NOT NULL,
      total_amount REAL NOT NULL DEFAULT 0,
      total_cost_of_goods REAL DEFAULT 0,
      total_profit REAL DEFAULT 0,
      profit_margin REAL DEFAULT 0,
      payment_type TEXT DEFAULT 'cash',
      input_method TEXT DEFAULT 'manual_form',
      raw_input TEXT,
      notes TEXT,
      sync_status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      is_recurring INTEGER DEFAULT 0,
      recurring_frequency TEXT DEFAULT 'none',
      raw_input TEXT,
      sync_status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS credits (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      user_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      customer_note TEXT,
      items TEXT NOT NULL DEFAULT '[]',
      total_amount REAL NOT NULL,
      amount_paid REAL DEFAULT 0,
      balance REAL NOT NULL,
      date_given TEXT NOT NULL,
      due_date TEXT,
      status TEXT DEFAULT 'outstanding',
      payments TEXT DEFAULT '[]',
      sync_status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id TEXT PRIMARY KEY,
      last_sync_at TEXT,
      sync_type TEXT,
      status TEXT,
      records_synced INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_sales_user_date ON sales(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_sales_sync ON sales(sync_status, is_deleted);
    CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_expenses_sync ON expenses(sync_status, is_deleted);
    CREATE INDEX IF NOT EXISTS idx_credits_user ON credits(user_id, status);
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_credits_sync ON credits(sync_status, is_deleted);
    CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id, is_active);
  `);

  // Migration: add customer_name to sales if not exists
  try {
    await database.execAsync("ALTER TABLE sales ADD COLUMN customer_name TEXT;");
  } catch {}

  // Migration: add invoice_number to sales if not exists
  try {
    await database.execAsync("ALTER TABLE sales ADD COLUMN invoice_number TEXT;");
  } catch {}

  // Migrations: discount / tax fields
  try { await database.execAsync("ALTER TABLE sales ADD COLUMN subtotal REAL DEFAULT 0;"); } catch {}
  try { await database.execAsync("ALTER TABLE sales ADD COLUMN discount REAL DEFAULT 0;"); } catch {}
  try { await database.execAsync("ALTER TABLE sales ADD COLUMN discount_type TEXT DEFAULT 'fixed';"); } catch {}
  try { await database.execAsync("ALTER TABLE sales ADD COLUMN discount_amount REAL DEFAULT 0;"); } catch {}
  try { await database.execAsync("ALTER TABLE sales ADD COLUMN tax REAL DEFAULT 0;"); } catch {}
  try { await database.execAsync("ALTER TABLE sales ADD COLUMN tax_amount REAL DEFAULT 0;"); } catch {}
};
