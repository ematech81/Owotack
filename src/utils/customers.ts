import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDb } from "../database/schema";
import { customerDb } from "../database/customerDb";

// Returns names of ACTIVE customers for use in autocomplete pickers.
// Sources (merged + de-duped):
//   1. customers table (active only) — the canonical source
//   2. credits table (customer_name) — legacy source
//   3. AsyncStorage customers:{userId} — legacy source from sales
export async function getSavedCustomers(userId: string): Promise<string[]> {
  try {
    const [activeCustomers, savedRaw, db] = await Promise.all([
      customerDb.getActive(userId),
      AsyncStorage.getItem(`customers:${userId}`),
      getDb(),
    ]);

    const fromTable = activeCustomers.map((c) => c.name);

    const saved: string[] = savedRaw ? JSON.parse(savedRaw) : [];

    const rows = await db.getAllAsync<{ customer_name: string }>(
      "SELECT DISTINCT customer_name FROM credits WHERE user_id = ? AND is_deleted = 0 ORDER BY customer_name ASC",
      [userId]
    );
    const fromCredits = rows.map((r) => r.customer_name);

    const combined = [...new Set([...fromTable, ...fromCredits, ...saved])].sort((a, b) =>
      a.localeCompare(b)
    );
    return combined;
  } catch {
    return [];
  }
}

// Saves a customer name from a sale or credit entry.
// Writes to both AsyncStorage (legacy) and the customers table.
export async function saveCustomerName(userId: string, name: string): Promise<void> {
  const normalized = name.trim();
  if (!normalized) return;
  try {
    // Legacy AsyncStorage store
    const raw = await AsyncStorage.getItem(`customers:${userId}`);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    if (!arr.some((n) => n.toLowerCase() === normalized.toLowerCase())) {
      await AsyncStorage.setItem(`customers:${userId}`, JSON.stringify([...arr, normalized]));
    }
    // Upsert into customers table so it appears in the Customers screen
    await customerDb.upsertByName(userId, normalized);
  } catch {}
}
