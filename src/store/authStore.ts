import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { User } from "../types";
import { authService, clearTokens, getStoredToken } from "../services/authService";
import { clearTipCache } from "../services/aiService";
import api from "../services/api";
import { ApiResponse } from "../types";

const USER_CACHE_KEY = "cached_user";
const ONBOARDED_KEY = "has_onboarded";
const EVER_LOGGED_IN_KEY = "has_ever_logged_in";
const STORED_PIN_KEY = "stored_pin";
const AUTO_LOGIN_KEY = "auto_login_enabled";

const saveUserCache = async (user: User) => {
  await SecureStore.setItemAsync(USER_CACHE_KEY, JSON.stringify(user));
};

const clearUserCache = async () => {
  await SecureStore.deleteItemAsync(USER_CACHE_KEY);
};

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  hasOnboarded: boolean;
  /** True once the user has successfully logged in or registered — never reset on logout. */
  hasEverLoggedIn: boolean;
  pinLocked: boolean;
  autoLoginEnabled: boolean;
  /** Last phone number used to log in. Persisted so the login screen can skip phone entry. */
  lastPhone: string | null;

  initialize: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  setAutoLogin: (enabled: boolean) => Promise<void>;
  login: (phone: string, pin: string) => Promise<void>;
  register: (data: Parameters<typeof authService.register>[0]) => Promise<void>;
  logout: () => Promise<void>;
  resetApp: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  hasOnboarded: false,
  hasEverLoggedIn: false,
  pinLocked: false,
  autoLoginEnabled: false,
  lastPhone: null,

  initialize: async () => {
    try {
      const [token, onboarded, rawCached, everLoggedIn, autoLogin, lastPhoneRaw] = await Promise.all([
        getStoredToken(),
        SecureStore.getItemAsync(ONBOARDED_KEY),
        SecureStore.getItemAsync(USER_CACHE_KEY),
        SecureStore.getItemAsync(EVER_LOGGED_IN_KEY),
        SecureStore.getItemAsync(AUTO_LOGIN_KEY),
        SecureStore.getItemAsync("last_phone"),
      ]);

      const hasOnboarded = onboarded === "true" || everLoggedIn === "true";
      const hasEverLoggedIn = everLoggedIn === "true";
      const autoLoginEnabled = autoLogin === "true";
      const lastPhone = lastPhoneRaw ?? null;

      let cached: User | null = null;
      try { cached = rawCached ? JSON.parse(rawCached) : null; } catch { cached = null; }

      if (!cached) {
        set({ isInitialized: true, hasOnboarded, hasEverLoggedIn, pinLocked: false, autoLoginEnabled, lastPhone });
        return;
      }

      // Auto-login: skip PIN screen if user opted in and token is still valid
      if (autoLoginEnabled && token) {
        set({
          user: cached,
          isAuthenticated: true,
          pinLocked: false,
          isInitialized: true,
          hasOnboarded: true,
          hasEverLoggedIn: true,
          autoLoginEnabled: true,
          lastPhone,
        });
        // Silently refresh user profile — token errors handled by api interceptor
        api.get<ApiResponse<User>>("/users/me")
          .then(async (res) => {
            await saveUserCache(res.data.data);
            set((s) => ({ ...s, user: res.data.data }));
          })
          .catch(() => { /* interceptor handles 401 → logout */ });
        return;
      }

      // Has cached user — show PIN unlock screen
      set({
        user: cached,
        isAuthenticated: false,
        pinLocked: true,
        isInitialized: true,
        hasOnboarded: true,
        hasEverLoggedIn: true,
        autoLoginEnabled,
        lastPhone,
      });
    } catch {
      set({ isInitialized: true });
    }
  },

  unlockWithPin: async (pin: string): Promise<boolean> => {
    const storedPin = await SecureStore.getItemAsync(STORED_PIN_KEY);

    if (!storedPin) {
      await clearUserCache();
      set({ pinLocked: false, isAuthenticated: false });
      return false;
    }

    if (storedPin !== pin) {
      return false;
    }

    const token = await getStoredToken();
    if (!token) {
      await clearUserCache();
      set({ pinLocked: false, isAuthenticated: false });
      return false;
    }

    set({ isAuthenticated: true, pinLocked: false });
    return true;
  },

  setAutoLogin: async (enabled: boolean) => {
    await SecureStore.setItemAsync(AUTO_LOGIN_KEY, enabled ? "true" : "false");
    set({ autoLoginEnabled: enabled });
  },

  completeOnboarding: async () => {
    await SecureStore.setItemAsync(ONBOARDED_KEY, "true");
    set({ hasOnboarded: true });
  },

  login: async (phone, pin) => {
    set({ isLoading: true });
    try {
      const { user } = await authService.login(phone, pin);
      await saveUserCache(user);
      await Promise.all([
        SecureStore.setItemAsync(ONBOARDED_KEY, "true"),
        SecureStore.setItemAsync(EVER_LOGGED_IN_KEY, "true"),
        SecureStore.setItemAsync(STORED_PIN_KEY, pin),
        SecureStore.setItemAsync("last_phone", phone),
      ]);
      set({ user, isAuthenticated: true, hasOnboarded: true, hasEverLoggedIn: true, pinLocked: false, lastPhone: phone });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const { user } = await authService.register(data);
      await saveUserCache(user);
      await Promise.all([
        SecureStore.setItemAsync(ONBOARDED_KEY, "true"),
        SecureStore.setItemAsync(EVER_LOGGED_IN_KEY, "true"),
        SecureStore.setItemAsync(STORED_PIN_KEY, data.pin),
        SecureStore.setItemAsync("last_phone", data.phone),
      ]);
      set({ user, isAuthenticated: true, hasOnboarded: true, hasEverLoggedIn: true, pinLocked: false, lastPhone: data.phone });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    const userId = useAuthStore.getState().user?._id?.toString();
    await authService.logout();
    await clearUserCache();
    if (userId) clearTipCache(userId); // prevent this user's tip showing on next login
    // NEVER clear EVER_LOGGED_IN or ONBOARDED — returning user goes to login, not onboarding
    set({ user: null, isAuthenticated: false, pinLocked: false });
  },

  // Full factory reset — clears everything, app restarts from onboarding
  resetApp: async () => {
    clearTipCache(); // wipe entire cache since we're resetting everything
    await authService.logout().catch(() => {});
    await Promise.all([
      SecureStore.deleteItemAsync(USER_CACHE_KEY),
      SecureStore.deleteItemAsync(ONBOARDED_KEY),
      SecureStore.deleteItemAsync(EVER_LOGGED_IN_KEY),
      SecureStore.deleteItemAsync(STORED_PIN_KEY),
      SecureStore.deleteItemAsync(AUTO_LOGIN_KEY),
      SecureStore.deleteItemAsync("accessToken"),
      SecureStore.deleteItemAsync("refreshToken"),
      SecureStore.deleteItemAsync("last_phone"),
    ]);
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      hasOnboarded: false,
      hasEverLoggedIn: false,
      pinLocked: false,
      autoLoginEnabled: false,
      lastPhone: null,
    });
    // _layout.tsx guard sees hasEverLoggedIn=false + hasOnboarded=false → routes to onboarding
  },

  setUser: (user) => set({ user }),
}));
