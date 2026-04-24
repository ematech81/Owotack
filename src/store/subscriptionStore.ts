import { create } from "zustand";
import { subscriptionService, SubscriptionStatus } from "../services/subscriptionService";
import { PlanId } from "../config/plans";
import { useAuthStore } from "./authStore";

interface SubscriptionState {
  status: SubscriptionStatus | null;
  isLoading: boolean;
  isVerifying: boolean;
  pendingReference: string | null;

  loadStatus: () => Promise<void>;
  initializeCheckout: (planId: PlanId) => Promise<string>;
  verifyPayment: (reference: string) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  setPendingReference: (ref: string | null) => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  status: null,
  isLoading: false,
  isVerifying: false,
  pendingReference: null,

  loadStatus: async () => {
    set({ isLoading: true });
    try {
      const status = await subscriptionService.getStatus();
      set({ status });
    } finally {
      set({ isLoading: false });
    }
  },

  initializeCheckout: async (planId: PlanId): Promise<string> => {
    const result = await subscriptionService.initialize(planId);
    set({ pendingReference: result.reference });
    return result.authorizationUrl;
  },

  verifyPayment: async (reference: string) => {
    set({ isVerifying: true });
    try {
      await subscriptionService.verify(reference);
      // Refresh subscription status and user profile
      await get().loadStatus();
      // Also refresh the cached user so plan shows correctly everywhere
      const { setUser, user } = useAuthStore.getState();
      if (user && get().status) {
        setUser({ ...user, subscription: { plan: get().status!.plan, status: get().status!.status } });
      }
      set({ pendingReference: null });
    } finally {
      set({ isVerifying: false });
    }
  },

  cancelSubscription: async () => {
    await subscriptionService.cancel();
    await get().loadStatus();
  },

  setPendingReference: (ref) => set({ pendingReference: ref }),
}));
