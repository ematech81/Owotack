import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from "axios";
import * as SecureStore from "expo-secure-store";
import { ApiResponse } from "../types";
import { ApiIPAddress } from "../utils/config";
import { useUIStore } from "../store/uiStore";
import { secureRead } from "../utils/secureStore";

const API_URL = ApiIPAddress;
// const APP_KEY = process.env.EXPO_PUBLIC_APP_KEY ?? "";

// Callback registered by _layout.tsx — fires when refresh token is also expired
type AuthFailHandler = () => void;
let _onAuthFail: AuthFailHandler | null = null;
export const registerAuthFailHandler = (fn: AuthFailHandler) => { _onAuthFail = fn; };

// Callback registered by useOfflineSync — fires the moment the app comes back online,
// so a sale/expense that failed to sync (e.g. a brief network blip right after saving)
// gets retried immediately instead of waiting for the next app foreground event.
type ReconnectHandler = () => void;
let _onReconnect: ReconnectHandler | null = null;
export const registerReconnectHandler = (fn: ReconnectHandler) => { _onReconnect = fn; };
let _wasOffline = false;

// Mutex: only one refresh in flight at a time; queue other 401s to replay after
let _isRefreshing = false;
let _refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (err: unknown, token: string | null) => {
  _refreshQueue.forEach((p) => (err ? p.reject(err) : p.resolve(token!)));
  _refreshQueue = [];
};

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // Timeout-guarded — an unguarded read here can hang indefinitely on some Android
  // Keystore implementations, freezing the request before axios's own timeout ever
  // starts (the request is never dispatched).
  const token = await secureRead("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Successful response confirms we're online
    if (_wasOffline) {
      _wasOffline = false;
      _onReconnect?.();
    }
    useUIStore.getState().setOnline(true);
    return response;
  },
  async (error) => {
    // No response object = network is unreachable (offline, DNS failure, timeout)
    if (!error.response) {
      _wasOffline = true;
      useUIStore.getState().setOnline(false);
    } else {
      // Server responded — we are online even if it's an error status
      if (_wasOffline) {
        _wasOffline = false;
        _onReconnect?.();
      }
      useUIStore.getState().setOnline(true);
    }
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Checked and set synchronously — before any `await` — so two 401s arriving
      // close together can't both slip past this and both kick off a refresh call
      // (the old version checked this only after an `await SecureStore...`, leaving
      // a race window where both requests would see _isRefreshing as false).
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _refreshQueue.push({
            resolve: (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }
      _isRefreshing = true;

      try {
        const refreshToken = await secureRead("refreshToken");
        if (!refreshToken) {
          // Already logged out — don't attempt a refresh, but do force the app
          // back to login instead of leaving it stuck half-authenticated.
          processQueue(error, null);
          _onAuthFail?.();
          return Promise.reject(error);
        }

        const response = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
          `${API_URL}/auth/refresh-token`,
          { refreshToken },
          { headers: { "Content-Type": "application/json" } }
        );

        const { accessToken, refreshToken: newRefresh } = response.data.data;
        await SecureStore.setItemAsync("accessToken", accessToken);
        await SecureStore.setItemAsync("refreshToken", newRefresh);

        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await SecureStore.deleteItemAsync("accessToken");
        await SecureStore.deleteItemAsync("refreshToken");
        _onAuthFail?.();
        return Promise.reject(refreshError);
      } finally {
        _isRefreshing = false;
      }
    }

    if (error.response?.status !== 401) {
      console.error("[API Error]", {
        url: error.config?.url,
        status: error.response?.status,
        message: error.message,
      });
    }
    return Promise.reject(error);
  }
);

export default api;
