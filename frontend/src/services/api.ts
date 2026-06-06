import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import SecureStore from '../utils/secureStore';
import { APP_CONFIG } from '../constants/config';

export const BASE_URL = APP_CONFIG.api.baseUrl;

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: APP_CONFIG.api.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach the current access token.
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Token-refresh mutex. When the first 401 arrives, we kick off a refresh and
 * stash the promise. Any other 401 that lands while the refresh is in flight
 * awaits the same promise instead of starting its own. This eliminates the
 * race where two parallel refreshes each issued tokens and the loser
 * overwrote the winner.
 */
let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync('refreshToken');
  if (!refreshToken) return null;
  try {
    const response = await axios.post(
      `${BASE_URL}/auth/refresh-token`,
      { refreshToken },
      { timeout: APP_CONFIG.api.timeout },
    );
    const accessToken = response.data.access_token ?? response.data.accessToken;
    const newRefreshToken = response.data.refresh_token ?? response.data.refreshToken;
    if (!accessToken) return null;
    await SecureStore.setItemAsync('accessToken', accessToken);
    if (newRefreshToken) {
      await SecureStore.setItemAsync('refreshToken', newRefreshToken);
    }
    return accessToken;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    // Single-flight refresh.
    refreshPromise = refreshPromise ?? performRefresh();
    const newToken = await refreshPromise;
    refreshPromise = null;

    if (!newToken) {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      return Promise.reject(error);
    }

    originalRequest.headers = originalRequest.headers ?? {};
    originalRequest.headers.Authorization = `Bearer ${newToken}`;
    return api(originalRequest);
  }
);

export default api;
