export interface User {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  businessName?: string;
  businessType?: string;
  location: {
    country: string;
    state?: string;
    city?: string;
    market?: string;
  };
  preferredLanguage: "pidgin" | "english";
  currency: string;
  subscription: {
    plan: "free" | "growth" | "pro" | "business";
    status: "active" | "inactive" | "cancelled" | "expired";
    startDate?: string;
    expiresAt?: string;
  };
  notifications: {
    dailyReminder: boolean;
    dailyReminderTime: string;
    weeklyReport: boolean;
    creditReminders: boolean;
  };
  healthScore: number;
  loanEligible: boolean;
  referralCode: string;
  streakDays: number;
  isPhoneVerified: boolean;
  createdAt: string;
}

export interface SaleItem {
  productName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  costPrice?: number;
  totalAmount: number;
  profit?: number;
}

export interface Sale {
  _id: string;
  userId: string;
  date: string;
  items: SaleItem[];
  totalAmount: number;
  totalCostOfGoods: number;
  totalProfit: number;
  profitMargin: number;
  paymentType: "cash" | "transfer" | "pos" | "credit" | "mixed";
  inputMethod: "voice" | "text" | "manual_form";
  rawInput?: string;
  notes?: string;
  customerName?: string;
  syncStatus: "synced" | "pending" | "failed";
  localId: string;
  isDeleted: boolean;
  createdAt: string;
}

export interface Expense {
  _id: string;
  userId: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  isRecurring: boolean;
  recurringFrequency?: "daily" | "weekly" | "monthly" | "none";
  syncStatus: "synced" | "pending" | "failed";
  localId: string;
  isDeleted: boolean;
  createdAt: string;
}

export interface CreditPayment {
  amount: number;
  date: string;
  method: string;
  note?: string;
}

export interface Credit {
  _id: string;
  userId: string;
  customerName: string;
  customerPhone?: string;
  customerNote?: string;
  items: { description: string; amount: number }[];
  totalAmount: number;
  amountPaid: number;
  balance: number;
  dateGiven: string;
  dueDate?: string;
  status: "outstanding" | "partially_paid" | "fully_paid" | "overdue" | "written_off";
  payments: CreditPayment[];
  syncStatus: "synced" | "pending" | "failed";
  localId: string;
  isDeleted: boolean;
  createdAt: string;
}

export interface DailySummary {
  _id: string;
  userId: string;
  date: string;
  totalSales: number;
  totalCostOfGoods: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  creditGiven: number;
  creditCollected: number;
  bestProduct?: { name: string; amount: number };
  aiInsight?: string;
}

export interface Customer {
  id: string;
  userId: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  error: { code: string; details: string | null } | null;
  meta: { page: number; limit: number; total: number } | null;
}
