import api from "./api";
import { ApiResponse } from "../types";

export interface DayPoint {
  date: string;
  label: string;
  totalSales: number;
  netProfit: number;
  totalExpenses: number;
}

export interface WeekPoint {
  label: string;
  totalSales: number;
  netProfit: number;
}

export interface ExpenseBreakdown {
  stock_purchase: number;
  transportation: number;
  market_levy: number;
  labor: number;
  utilities: number;
  other: number;
}

export interface TopProduct {
  name: string;
  amount: number;
}

export interface PaymentBreakdown {
  cash: number;
  transfer: number;
  pos: number;
  credit: number;
  mixed: number;
}

interface ReportBase {
  totalSales: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  totalCostOfGoods: number;
  expenseBreakdown: ExpenseBreakdown;
  creditGiven: number;
  creditCollected: number;
  totalOutstandingCredits: number;
  salesCount: number;
  avgSaleValue: number;
  paymentBreakdown: PaymentBreakdown;
  salesGrowthPercent: number;
  profitGrowthPercent: number;
}

export interface DailyReport extends ReportBase {
  bestProduct?: { name: string; amount: number };
}

export interface WeeklyReport extends ReportBase {
  topProducts: TopProduct[];
  days: DayPoint[];
}

export interface MonthlyReport extends ReportBase {
  topProducts: TopProduct[];
  weeks: WeekPoint[];
}

export const reportService = {
  async getDaily(date: string): Promise<DailyReport> {
    const res = await api.get<ApiResponse<DailyReport>>("/reports/daily", { params: { date } });
    return res.data.data;
  },

  async getWeekly(date: string): Promise<WeeklyReport> {
    const res = await api.get<ApiResponse<WeeklyReport>>("/reports/weekly", { params: { date } });
    return res.data.data;
  },

  async getMonthly(year: number, month: number): Promise<MonthlyReport> {
    const res = await api.get<ApiResponse<MonthlyReport>>("/reports/monthly", { params: { year, month } });
    return res.data.data;
  },
};
