import api from "./api";
import { ApiResponse } from "../types";
import { PlanId } from "../config/plans";

export interface SubscriptionStatus {
  plan: PlanId;
  status: "active" | "inactive" | "cancelled" | "expired";
  startDate?: string;
  expiresAt?: string;
  planDetails: {
    name: string;
    priceNaira: number;
    badge?: string;
  };
}

export interface CheckoutResult {
  authorizationUrl: string;
  reference: string;
}

export const subscriptionService = {
  async getStatus(): Promise<SubscriptionStatus> {
    const res = await api.get<ApiResponse<SubscriptionStatus>>("/subscription/status");
    return res.data.data;
  },

  async initialize(planId: PlanId): Promise<CheckoutResult> {
    const res = await api.post<ApiResponse<CheckoutResult>>(`/subscription/initialize/${planId}`);
    return res.data.data;
  },

  async verify(reference: string): Promise<{ planId: string; status: string }> {
    const res = await api.get<ApiResponse<{ planId: string; status: string }>>(
      `/subscription/verify/${reference}`
    );
    return res.data.data;
  },

  async cancel(): Promise<void> {
    await api.post("/subscription/cancel");
  },
};
