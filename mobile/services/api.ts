/**
 * SMSS — API Service
 * Axios instance with:
 * - Bearer token injection
 * - Silent 401 → refresh → retry logic
 * - Logout on unrecoverable 401
 * - Human-readable error codes
 * - 50s timeout for Render free-tier cold starts
 */
import axios, { AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_ROUTES } from '@/constants/api';
import { useAuthStore } from '@/store/authStore';

// ── Axios instance ─────────────────────────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 50000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

// ── Request interceptor: attach Bearer token ──────────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (__DEV__) console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

// ── Response interceptor: 401 → refresh → retry ───────────────────────────────
let isRefreshing = false;
let failedQueue: { resolve: (t: string) => void; reject: (e: unknown) => void }[] = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token!));
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (r: AxiosResponse) => r,
  async (error: AxiosError) => {
    const orig = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!error.response) {
      const isTimeout = error.code === 'ECONNABORTED';
      return Promise.reject({
        ...error,
        response: {
          data: {
            error: isTimeout ? 'timeout' : 'network_error',
            detail: isTimeout
              ? 'The server took too long. It may be waking up — try again in a moment.'
              : `Cannot reach the server at ${API_BASE_URL}. Check your network.`,
          },
        },
      });
    }

    if (error.response?.status === 401 && !orig._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              orig.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(orig));
            },
            reject,
          });
        });
      }

      orig._retry    = true;
      isRefreshing   = true;
      const refresh  = useAuthStore.getState().refreshToken;

      if (!refresh) {
        await useAuthStore.getState().clearAuth();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_BASE_URL}${API_ROUTES.refresh}`, { refresh });
        const newToken: string = data.access;
        useAuthStore.getState().setAccessToken(newToken);
        processQueue(null, newToken);
        orig.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(orig);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ── Error message extractor ────────────────────────────────────────────────────
export function getApiError(err: unknown, fallback = 'Something went wrong.'): string {
  if (axios.isAxiosError(err)) {
    const d = (err.response?.data as { error?: string; detail?: string });
    if (d?.detail) return d.detail;
    if (!err.response) return 'No internet connection.';
    return `Server error ${err.response.status}`;
  }
  return fallback;
}

// ── Auth service ───────────────────────────────────────────────────────────────
export const authService = {
  ownerLogin:  (email: string, password: string) =>
    apiClient.post(API_ROUTES.ownerLogin,  { email, password }),
  workerLogin: (centreId: string) =>
    apiClient.post(API_ROUTES.workerLogin, { centreId }),
  logout:      (refresh: string) =>
    apiClient.post(API_ROUTES.logout, { refresh }),
  me:          () => apiClient.get(API_ROUTES.me),
};

// ── Centre service (owner) ─────────────────────────────────────────────────────
export const centreService = {
  list:       ()                         => apiClient.get(API_ROUTES.centres),
  get:        (id: string)               => apiClient.get(API_ROUTES.centre(id)),
  create:     (body: object)             => apiClient.post(API_ROUTES.centres, body),
  update:     (id: string, body: object) => apiClient.patch(API_ROUTES.centre(id), body),
  deactivate: (id: string)               => apiClient.delete(API_ROUTES.centre(id)),
};

// ── Worker service (owner) ─────────────────────────────────────────────────────
export const workerService = {
  list:     ()                           => apiClient.get(API_ROUTES.workers),
  get:      (id: string)                 => apiClient.get(API_ROUTES.worker(id)),
  register: (body: object)               => apiClient.post(API_ROUTES.workers, body),
  update:   (id: string, body: object)   => apiClient.patch(API_ROUTES.worker(id), body),
  assign:   (id: string, centreId: string) => apiClient.post(API_ROUTES.assignWorker(id), { centreId }),
  transfer: (id: string, centreId: string) => apiClient.post(API_ROUTES.transferWorker(id), { centreId }),
  remove:   (id: string)                 => apiClient.delete(API_ROUTES.worker(id)),
};

// ── Stock service ──────────────────────────────────────────────────────────────
export const stockService = {
  list:   (centreId?: string) =>
    apiClient.get(API_ROUTES.stock + (centreId ? `?centreId=${centreId}` : '')),
  create: (body: object)             => apiClient.post(API_ROUTES.stock, body),
  update: (id: string, body: object) => apiClient.patch(API_ROUTES.stockItem(id), body),
  delete: (id: string)               => apiClient.delete(API_ROUTES.stockItem(id)),
};

// ── Service events ─────────────────────────────────────────────────────────────
export const serviceEventService = {
  list:   (params?: { centreId?: string; date?: string; type?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return apiClient.get(API_ROUTES.services + (q ? `?${q}` : ''));
  },
  log:    (body: object)             => apiClient.post(API_ROUTES.services, body),
  update: (id: string, body: object) => apiClient.patch(API_ROUTES.service(id), body),
  delete: (id: string)               => apiClient.delete(API_ROUTES.service(id)),
};

// ── Notices ────────────────────────────────────────────────────────────────────
export const noticeService = {
  list:   (centreId?: string) =>
    apiClient.get(API_ROUTES.notices + (centreId ? `?centreId=${centreId}` : '')),
  send:   (body: object) => apiClient.post(API_ROUTES.notices, body),
  markRead:(id: string)  => apiClient.post(API_ROUTES.readNotice(id), {}),
};

// ── Reports ────────────────────────────────────────────────────────────────────
export const reportService = {
  daily:  (params?: { date?: string; centreId?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return apiClient.get(API_ROUTES.reportDaily + (q ? `?${q}` : ''));
  },
  weekly: (params?: { weekStart?: string; centreId?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return apiClient.get(API_ROUTES.reportWeekly + (q ? `?${q}` : ''));
  },
};

// ── Push token ─────────────────────────────────────────────────────────────────
export const pushTokenService = {
  save: (token: string, platform?: 'ios' | 'android') =>
    apiClient.post(API_ROUTES.pushToken, { token, platform }),
};
