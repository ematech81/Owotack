import api from "./api";
import { ApiResponse } from "../types";

export interface IStockItem {
  _id: string;
  name: string;
  category: string;
  emoji: string;
  qty: number;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  dateEntered: string;
  lowStockThreshold: number;
  syncStatus: "synced" | "pending" | "failed";
  createdAt: string;
}

export interface StockStats {
  totalValue: number;
  lowCount: number;
  outCount: number;
  totalItems: number;
}

export const stockService = {
  async create(data: Partial<IStockItem>) {
    const res = await api.post<ApiResponse<IStockItem>>("/stock", data);
    return res.data.data;
  },

  async list(params?: { search?: string; category?: string; page?: number; limit?: number }) {
    const res = await api.get<ApiResponse<IStockItem[]>>("/stock", { params });
    return res.data.data;
  },

  async getStats() {
    const res = await api.get<ApiResponse<StockStats>>("/stock/stats");
    return res.data.data;
  },

  async update(id: string, data: Partial<IStockItem>) {
    const res = await api.patch<ApiResponse<IStockItem>>(`/stock/${id}`, data);
    return res.data.data;
  },

  async adjustQty(id: string, delta: number) {
    const res = await api.patch<ApiResponse<IStockItem>>(`/stock/${id}/adjust`, { delta });
    return res.data.data;
  },

  async delete(id: string) {
    await api.delete(`/stock/${id}`);
  },
};
