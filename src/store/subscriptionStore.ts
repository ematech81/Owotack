import { create } from "zustand";
import { subscriptionService, SubscriptionStatus, CheckoutResult } from "../services/subscriptionService";
import { PlanId } from "../config/plans";
import { useAuthStore } from "./authStore";

interface SubscriptionState {
  status: SubscriptionStatus | null;
  isLoading: boolean;
  isVerifying: boolean;

  loadStatus: () => Promise<void>;
  initializeCheckout: (planId: PlanId) => Promise<CheckoutResult>;
  verifyPayment: (txRef: string) => Promise<void>;
  cancelSubscription: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  status: null,
  isLoading: false,
  isVerifying: false,

  loadStatus: async () => {
    set({ isLoading: true });
    try {
      const status = await subscriptionService.getStatus();
      set({ status });
    } finally {
      set({ isLoading: false });
    }
  },

  initializeCheckout: async (planId: PlanId): Promise<CheckoutResult> => {
    return subscriptionService.initialize(planId);
  },

  verifyPayment: async (txRef: string) => {
    set({ isVerifying: true });
    try {
      await subscriptionService.verify(txRef);
      // Refresh subscription status and sync it into the auth store
      await get().loadStatus();
      const { setUser, user } = useAuthStore.getState();
      if (user && get().status) {
        setUser({
          ...user,
          subscription: { plan: get().status!.plan, status: get().status!.status },
        });
      }
    } finally {
      set({ isVerifying: false });
    }
  },

  cancelSubscription: async () => {
    await subscriptionService.cancel();
    await get().loadStatus();
  },
}));
