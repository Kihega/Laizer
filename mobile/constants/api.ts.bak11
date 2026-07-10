/**
 * SMSS — API Configuration
 * __LAIZER_PATCH_V8__
 *
 * URL resolution order (first match wins):
 *   1. EXPO_PUBLIC_API_URL          — from mobile/.env or mobile/.env.local
 *   2. app.json → expo.extra.apiUrl — via expo-constants (works in EAS
 *                                      builds where .env isn't bundled)
 *   3. Platform dev guess           — 10.0.2.2 (Android emulator) /
 *                                      localhost (iOS simulator). This
 *                                      ONLY works for emulators/simulators
 *                                      on the same machine as the backend —
 *                                      a physical phone needs your LAN IP
 *                                      set via EXPO_PUBLIC_API_URL instead.
 *   4. Production Render URL
 *
 * All requests funnel through `API_BASE_URL` below — nothing in the app
 * hardcodes a host anywhere else, so changing the env var is enough to
 * repoint the whole app (dev, staging, prod, physical device, emulator).
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getLocalDevUrl(): string {
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}

function normalize(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    if (__DEV__) console.warn(`[SMSS] API URL "{trimmed}" is missing http(s):// — adding it.`);
    return `http://${trimmed}`;
  }
  return trimmed;
}

const extraApiUrl: string | undefined =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  (Constants.expoConfig?.extra as any)?.eas?.apiUrl;

const PRODUCTION_API_URL = 'https://smss-api.onrender.com';

let resolvedFrom = 'production-fallback';
let rawUrl: string;

if (process.env.EXPO_PUBLIC_API_URL) {
  rawUrl = process.env.EXPO_PUBLIC_API_URL;
  resolvedFrom = 'EXPO_PUBLIC_API_URL (.env)';
} else if (__DEV__) {
  if (extraApiUrl && extraApiUrl !== PRODUCTION_API_URL) {
    rawUrl = extraApiUrl;
    resolvedFrom = 'app.json extra.apiUrl';
  } else {
    rawUrl = getLocalDevUrl();
    resolvedFrom = `platform dev guess (${Platform.OS})`;
  }
} else if (extraApiUrl) {
  rawUrl = extraApiUrl;
  resolvedFrom = 'app.json extra.apiUrl';
} else {
  rawUrl = PRODUCTION_API_URL;
}

export const API_BASE_URL: string = normalize(rawUrl);

if (__DEV__) {
  console.log(`[SMSS] API_BASE_URL → ${API_BASE_URL}  (source: ${resolvedFrom})`);
  if (resolvedFrom.startsWith('platform dev guess') && Platform.OS !== 'web') {
    console.warn(
      '[SMSS] Using a dev-guess API URL. If you are on a PHYSICAL DEVICE ' +
      '(not an emulator/simulator), this address is NOT reachable. ' +
      'Set EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:8000 in ' +
      'mobile/.env (see mobile/.env.local.example) and restart `expo start -c`.'
    );
  }
}

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

  // Equipment (office utilities)
  equipment:     '/api/equipment/',
  equipmentItem: (id: string) => `/api/equipment/${id}/`,

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
