/**
 * SMSS — API Configuration
 * URL resolution order (first match wins):
 *   1. EXPO_PUBLIC_API_URL from .env
 *   2. Android emulator  → 10.0.2.2:8000
 *   3. iOS simulator     → localhost:8000
 *   4. Production Render URL
 */
import { Platform } from 'react-native';

function getLocalDevUrl(): string {
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}

const PRODUCTION_API_URL = 'https://smss-api.onrender.com';

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? getLocalDevUrl() : PRODUCTION_API_URL);

if (__DEV__) console.log(`[SMSS] API_BASE_URL → ${API_BASE_URL}`);

export const API_ROUTES = {
  // Auth
  ownerLogin:    '/api/auth/owner/login/',
  ownerRegister:   '/api/auth/owner/register/',
  changePassword:  '/api/auth/change-password/',
  workerLogin:  '/api/auth/worker/login/',
  refresh:      '/api/auth/refresh/',
  logout:       '/api/auth/logout/',
  me:           '/api/auth/me/',

  // Health
  health: '/api/health/',

  // Centres (owner)
  centres:      '/api/centres/',
  centre:       (id: string) => `/api/centres/${id}/`,

  // Workers (owner)
  workers:      '/api/workers/',
  worker:       (id: string) => `/api/workers/${id}/`,
  assignWorker: (id: string) => `/api/workers/${id}/assign/`,
  transferWorker:(id: string)=> `/api/workers/${id}/transfer/`,

  // Stock
  stock:        '/api/stock/',
  stockItem:    (id: string) => `/api/stock/${id}/`,

  // Services
  services:     '/api/services/',
  service:      (id: string) => `/api/services/${id}/`,

  // Notices
  notices:      '/api/notices/',
  readNotice:   (id: string) => `/api/notices/${id}/read/`,

  // Reports
  reportDaily:  '/api/reports/daily/',
  reportWeekly: '/api/reports/weekly/',

  // Push token
  pushToken:    '/api/push-token/',
} as const;
