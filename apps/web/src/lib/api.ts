import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

/** Để trống để gọi cùng origin qua Vite proxy (HttpOnly cookie same-site). */
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

/** Access token trong memory (không localStorage) — bổ sung cho cookie HttpOnly. */
let memoryAccessToken: string | null = null;

/** Hàng đợi refresh — tránh gọi /auth/refresh song song khi nhiều request 401. */
let refreshPromise: Promise<string | null> | null = null;

export function setMemoryAccessToken(token: string | null) {
  memoryAccessToken = token;
}

export function getMemoryAccessToken() {
  return memoryAccessToken;
}

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (memoryAccessToken) {
    config.headers.Authorization = `Bearer ${memoryAccessToken}`;
  }
  return config;
});

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ accessToken: string }>(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true })
      .then(({ data }) => {
        if (data.accessToken) {
          setMemoryAccessToken(data.accessToken);
          return data.accessToken;
        }
        return null;
      })
      .catch(() => {
        setMemoryAccessToken(null);
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!original) {
      return Promise.reject(error);
    }

    const url = original.url ?? '';
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/logout') ||
      url.includes('/auth/me');

    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      const token = await refreshAccessToken();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
