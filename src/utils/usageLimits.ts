import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPlanById, isUnlimited } from "../config/plans";

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
function whatsappKey(userId: string) {
  return `usage:whatsapp:${userId}:${monthSuffix()}`;
}
function aiDayKey(userId: string) {
  return `usage:ai:${userId}:${todayYMD()}`;
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

export async function checkWhatsAppLimit(userId: string, planId: string): Promise<LimitResult> {
  const plan = getPlanById(planId as any);
  const limit = plan.limits.whatsappReminders;
  // 0 = no access (free plan), -1 = unlimited
  if (limit === 0) return { allowed: false, used: 0, limit: 0 };
  if (isUnlimited(limit)) return { allowed: true, used: 0, limit };
  const used = await getCount(whatsappKey(userId));
  return { allowed: used < limit, used, limit };
}

// ─── Record usage after successful action ────────────────────────────────────

export async function recordSaleUsage(userId: string): Promise<void> {
  await increment(salesKey(userId));
}

export async function recordExpenseUsage(userId: string): Promise<void> {
  await increment(expensesKey(userId));
}

export async function recordWhatsAppUsage(userId: string): Promise<void> {
  await increment(whatsappKey(userId));
}

// ─── Get current usage for display ───────────────────────────────────────────

export async function getSalesUsage(userId: string): Promise<number> {
  return getCount(salesKey(userId));
}

export async function getExpensesUsage(userId: string): Promise<number> {
  return getCount(expensesKey(userId));
}

// Active credits limit — based on current unpaid count, not monthly usage
export function checkActiveCreditsLimit(currentActiveCount: number, planId: string): LimitResult {
  const plan = getPlanById(planId as any);
  const limit = plan.limits.activeCredits;
  if (isUnlimited(limit)) return { allowed: true, used: currentActiveCount, limit };
  return { allowed: currentActiveCount < limit, used: currentActiveCount, limit };
}

// AI chats per day — free=0 (no access), growth=10, pro/business=-1 (unlimited)
export async function checkAIChatLimit(userId: string, planId: string): Promise<LimitResult> {
  const plan = getPlanById(planId as any);
  const limit = plan.limits.aiChatsPerDay;
  if (limit === 0) return { allowed: false, used: 0, limit: 0 };
  if (isUnlimited(limit)) return { allowed: true, used: 0, limit };
  const used = await getCount(aiDayKey(userId));
  return { allowed: used < limit, used, limit };
}

export async function recordAIChatUsage(userId: string): Promise<void> {
  await increment(aiDayKey(userId));
}

export async function getAIChatUsageToday(userId: string): Promise<number> {
  return getCount(aiDayKey(userId));
}
