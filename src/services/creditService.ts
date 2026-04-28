import api from "./api";
import { ApiResponse } from "../types";

export interface ICredit {
  _id: string;
  localId?: string;
  customerName: string;
  customerPhone?: string;
  description: string;
  amount: number;
  amountPaid: number;
  balance: number;
  dueDate: string;
  status: "active" | "due_soon" | "overdue" | "paid";
  payments: { amount: number; date: string; note?: string }[];
  syncStatus: "synced" | "pending" | "failed";
  createdAt: string;
}

export interface CreditStats {
  totalOutstanding: number;
  totalOriginal: number;
  percentCollected: number;
  overdueAmount: number;
  overdueCount: number;
  dueSoonAmount: number;
  dueSoonCount: number;
  collectedThisWeek: number;
}

export const creditService = {
  async create(data: Partial<ICredit>) {
    const res = await api.post<ApiResponse<ICredit>>("/credits", data);
    return res.data.data;
  },

  async list(status?: string) {
    const params = status && status !== "all" ? { status } : {};
    const res = await api.get<ApiResponse<ICredit[]>>("/credits", { params });
    return res.data.data;
  },

  async recordPayment(id: string, amount: number, note?: string) {
    const res = await api.post<ApiResponse<ICredit>>(`/credits/${id}/payment`, { amount, note });
    return res.data.data;
  },

  async updatePhone(id: string, phone: string) {
    const res = await api.patch<ApiResponse<ICredit>>(`/credits/${id}/phone`, { phone });
    return res.data.data;
  },

  async delete(id: string) {
    await api.delete(`/credits/${id}`);
  },

  async getStats() {
    const res = await api.get<ApiResponse<CreditStats>>("/credits/stats");
    return res.data.data;
  },
};
