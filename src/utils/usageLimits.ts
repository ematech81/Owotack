import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPlanById, isUnlimited } from "../config/plans";

export type LimitResult = {
  allowed: boolean;
  used: number;
  limit: number;
};

// Key includes year-month so limits auto-reset each month
function monthSuffix(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function salesKey(userId: string) {
  return `usage:sales:${userId}:${monthSuffix()}`;
}
function expensesKey(userId: string) {
  return `usage:expenses:${userId}:${monthSuffix()}`;
}

async function getCount(key: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

async function increment(key: string): Promise<void> {
  try {
    const current = await getCount(key);
    await AsyncStorage.setItem(key, String(current + 1));
  } catch { /* non-critical */ }
}

// ─── Check functions ──────────────────────────────────────────────────────────

export async function checkSalesLimit(userId: string, planId: string): Promise<LimitResult> {
  const plan = getPlanById(planId as any);
  const limit = plan.limits.salesPerMonth;
  if (isUnlimited(limit)) return { allowed: true, used: 0, limit };
  const used = await getCount(salesKey(userId));
  return { allowed: used < limit, used, limit };
}

export async function checkExpensesLimit(userId: string, planId: string): Promise<LimitResult> {
  const plan = getPlanById(planId as any);
  const limit = plan.limits.expensesPerMonth;
  if (isUnlimited(limit)) return { allowed: true, used: 0, limit };
  const used = await getCount(expensesKey(userId));
  return { allowed: used < limit, used, limit };
}

export function checkStockLimit(currentCount: number, planId: string): LimitResult {
  const plan = getPlanById(planId as any);
  const limit = plan.limits.stockItems;
  if (isUnlimited(limit)) return { allowed: true, used: currentCount, limit };
  return { allowed: currentCount < limit, used: currentCount, limit };
}

export function checkAIAccess(planId: string): boolean {
  const plan = getPlanById(planId as any);
  // aiChatsPerDay === 0 means no AI access; -1 means unlimited
  return plan.limits.aiChatsPerDay !== 0;
}

export function checkVoiceAccess(planId: string): boolean {
  const plan = getPlanById(planId as any);
  // voicePerMonth === 0 means no voice; -1 or >0 means allowed
  return plan.limits.voicePerMonth !== 0;
}

// ─── Record usage after successful action ────────────────────────────────────

export async function recordSaleUsage(userId: string): Promise<void> {
  await increment(salesKey(userId));
}

export async function recordExpenseUsage(userId: string): Promise<void> {
  await increment(expensesKey(userId));
}

// ─── Get current usage for display ───────────────────────────────────────────

export async function getSalesUsage(userId: string): Promise<number> {
  return getCount(salesKey(userId));
}

export async function getExpensesUsage(userId: string): Promise<number> {
  return getCount(expensesKey(userId));
}
