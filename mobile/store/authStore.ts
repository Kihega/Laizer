export interface CentreInfo { name:string; location:string; centreId:string; brandName:string; profilePicture:string|null; }

/**
 * SMSS — Auth Store (Zustand + SecureStore)
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export interface SmssUser {
  id:             string;
  fullName:       string;
  email?:         string | null;
  phone?:         string | null;
  nim?:           string | null;
  profilePicture?: string | null;
  role:           'owner' | 'worker';
  isActive:       boolean;
  lastLogin:      string | null;
  centreId?:      string | null;
}

interface AuthState {
  accessToken:     string | null;
  refreshToken:    string | null;
  user:            SmssUser | null;
  centreInfo:      CentreInfo | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
  loadingStatus:   string;   // human-readable status for the splash screen

  setAuth:        (access: string, refresh: string, user: SmssUser) => Promise<void>;
  setCentreInfo:  (info: CentreInfo | null) => void;
  setAccessToken: (token: string, refresh?: string) => void;
  clearAuth:      () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
}

const KEYS = {
  ACCESS:  'smss_access_token',
  REFRESH: 'smss_refresh_token',
  USER:    'smss_user_profile',
} as const;

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null, refreshToken: null, user: null, centreInfo: null,
  isAuthenticated: false, isLoading: true, loadingStatus: 'Starting up…',

  setAuth: async (accessToken, refreshToken, user) => {
    await SecureStore.setItemAsync(KEYS.ACCESS,  accessToken);
    await SecureStore.setItemAsync(KEYS.REFRESH, refreshToken);
    await SecureStore.setItemAsync(KEYS.USER,    JSON.stringify(user));
    set({ accessToken, refreshToken, user, isAuthenticated: true });
  },

  setCentreInfo:  (centreInfo) => set({ centreInfo }),
  setAccessToken: (token, refresh) => {
    SecureStore.setItemAsync(KEYS.ACCESS, token).catch(() => {});
    if (refresh) SecureStore.setItemAsync(KEYS.REFRESH, refresh).catch(() => {});
    set(refresh ? { accessToken: token, refreshToken: refresh } : { accessToken: token });
  },

  clearAuth: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS).catch(() => {}),
      SecureStore.deleteItemAsync(KEYS.REFRESH).catch(() => {}),
      SecureStore.deleteItemAsync(KEYS.USER).catch(() => {}),
    ]);
    set({ accessToken: null, refreshToken: null, user: null, centreInfo: null, isAuthenticated: false });
  },

  loadStoredAuth: async () => {
    set({ isLoading: true, loadingStatus: 'Loading stored session…' });
    // Hard 8-second timeout — prevents permanent spinner on network/SecureStore hang
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>(resolve => {
      timer = setTimeout(() => {
        set({ isLoading: false, loadingStatus: 'Timed out. Please retry.' });
        resolve();
      }, 8000);
    });
    const load = (async () => {
    try {
      const [access, refresh, userJson] = await Promise.all([
        SecureStore.getItemAsync(KEYS.ACCESS),
        SecureStore.getItemAsync(KEYS.REFRESH),
        SecureStore.getItemAsync(KEYS.USER),
      ]);

      if (!access || !refresh || !userJson) {
        set({ isLoading: false }); return;
      }

      // __LAIZER_PATCH_V17__ — restore the session as it is. If the access token
      // has expired, the first API call gets a 401 and the response interceptor
      // silently swaps it using the refresh token (and signs out only if that
      // refresh token is really invalid). Nothing here waits on the network, so
      // the app opens instantly even on a slow connection or a cold server.
      set({
        accessToken: access, refreshToken: refresh,
        user: JSON.parse(userJson), isAuthenticated: true,
        isLoading: false, loadingStatus: 'Session restored.',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      set({ isLoading: false, loadingStatus: `Error: ${msg}` });
    }
    })(); // end load IIFE
    await Promise.race([load, timeout]);
    if (timer) clearTimeout(timer);
  },
}));
