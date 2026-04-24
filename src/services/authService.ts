import * as SecureStore from "expo-secure-store";
import api from "./api";
import { User, ApiResponse } from "../types";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export const authService = {
  async sendOtp(phone: string) {
    const res = await api.post<ApiResponse<{ isNewUser: boolean; devOtp?: string }>>(
      "/auth/send-otp",
      { phone }
    );
    return res.data.data;
  },

  async verifyOtp(phone: string, otp: string) {
    const res = await api.post<ApiResponse<{ isNewUser: boolean; tempToken: string }>>(
      "/auth/verify-otp",
      { phone, otp }
    );
    return res.data.data;
  },

  async register(data: {
    tempToken: string;
    name: string;
    phone: string;
    businessName?: string;
    businessType?: string;
    location?: { state?: string; city?: string; market?: string };
    preferredLanguage: string;
    pin: string;
    referralCode?: string;
  }) {
    const res = await api.post<ApiResponse<AuthTokens>>("/auth/register", data);
    await saveTokens(res.data.data);
    return res.data.data;
  },

  async login(phone: string, pin: string) {
    const res = await api.post<ApiResponse<AuthTokens>>("/auth/login", { phone, pin });
    await saveTokens(res.data.data);
    return res.data.data;
  },

  async logout() {
    try {
      const refreshToken = await SecureStore.getItemAsync("refreshToken");
      await api.post("/auth/logout", { refreshToken });
    } catch {
      // Ignore network/auth errors — local token clearance is what matters
    } finally {
      await clearTokens();
    }
  },

  async changePin(currentPin: string, newPin: string) {
    await api.post("/auth/change-pin", { currentPin, newPin });
  },

  async forgotPin(phone: string) {
    const res = await api.post<ApiResponse<unknown>>("/auth/forgot-pin", { phone });
    return res.data;
  },

  async resetPin(phone: string, otp: string, newPin: string) {
    await api.post("/auth/reset-pin", { phone, otp, newPin });
  },
};

const saveTokens = async (data: AuthTokens) => {
  await SecureStore.setItemAsync("accessToken", data.accessToken);
  await SecureStore.setItemAsync("refreshToken", data.refreshToken);
};

export const clearTokens = async () => {
  await SecureStore.deleteItemAsync("accessToken");
  await SecureStore.deleteItemAsync("refreshToken");
};

export const getStoredToken = () => SecureStore.getItemAsync("accessToken");
