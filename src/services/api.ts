import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from "axios";
import * as SecureStore from "expo-secure-store";
import { ApiResponse } from "../types";
import { ApiIPAddress } from "../utils/config";
import { useUIStore } from "../store/uiStore";

const API_URL = ApiIPAddress;
// const APP_KEY = process.env.EXPO_PUBLIC_APP_KEY ?? "";

// Callback registered by _layout.tsx — fires when refresh token is also expired
type AuthFailHandler = () => void;
let _onAuthFail: AuthFailHandler | null = null;
export const registerAuthFailHandler = (fn: AuthFailHandler) => { _onAuthFail = fn; };

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
  const token = await SecureStore.getItemAsync("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Successful response confirms we're online
    useUIStore.getState().setOnline(true);
    return response;
  },
  async (error) => {
    // No response object = network is unreachable (offline, DNS failure, timeout)
    if (!error.response) {
      useUIStore.getState().setOnline(false);
    } else {
      // Server responded — we are online even if it's an error status
      useUIStore.getState().setOnline(true);
    }
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // No refresh token — already logged out, don't trigger logout loop
      const refreshToken = await SecureStore.getItemAsync("refreshToken");
      if (!refreshToken) return Promise.reject(error);

      // Another refresh is already in flight — queue this request
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
