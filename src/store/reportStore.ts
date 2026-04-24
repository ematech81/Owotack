import { create } from "zustand";
import { reportService, DailyReport, WeeklyReport, MonthlyReport } from "../services/reportService";

type Period = "today" | "week" | "month";

interface ReportState {
  period: Period;
  daily: DailyReport | null;
  weekly: WeeklyReport | null;
  monthly: MonthlyReport | null;
  isLoading: boolean;

  setPeriod: (p: Period) => void;
  loadDaily: (date: string) => Promise<void>;
  loadWeekly: (date: string) => Promise<void>;
  loadMonthly: (year: number, month: number) => Promise<void>;
}

export const useReportStore = create<ReportState>((set, get) => ({
  period: "today",
  daily: null,
  weekly: null,
  monthly: null,
  isLoading: false,

  setPeriod: (period) => set({ period }),

  loadDaily: async (date) => {
    set({ isLoading: true });
    try {
      const daily = await reportService.getDaily(date);
      set({ daily });
    } catch { /* silent */ } finally {
      set({ isLoading: false });
    }
  },

  loadWeekly: async (date) => {
    set({ isLoading: true });
    try {
      const weekly = await reportService.getWeekly(date);
      set({ weekly });
    } catch { /* silent */ } finally {
      set({ isLoading: false });
    }
  },

  loadMonthly: async (year, month) => {
    set({ isLoading: true });
    try {
      const monthly = await reportService.getMonthly(year, month);
      set({ monthly });
    } catch { /* silent */ } finally {
      set({ isLoading: false });
    }
  },
}));
