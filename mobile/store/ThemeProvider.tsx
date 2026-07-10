/**
 * SMSS — Theme Provider
 * __LAIZER_PATCH_V11__
 *
 * Single, app-wide source of truth for light/dark mode. Previously each
 * screen that wanted the theme called a hook that read its own private
 * copy from storage — a toggle on one screen had no way to reach any
 * other screen already on stack. This Provider is mounted ONCE at the
 * root (see app/_layout.tsx) so every screen that calls useTheme() reads
 * and writes the exact same live state.
 *
 * Persisted per signed-in user (AsyncStorage keyed by their id), so it
 * stays exactly as that person left it until THEY change it again, and
 * never leaks into another person's session on a shared device.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/authStore';

export type AppTheme = 'light' | 'dark';

export interface ThemeColors {
  bg: string; card: string; text: string; textSec: string; border: string; input: string;
}

const LIGHT: ThemeColors = { bg:'#F9FAFB', card:'#FFFFFF', text:'#111827', textSec:'#6B7280', border:'#E5E7EB', input:'#FFFFFF' };
const DARK:  ThemeColors = { bg:'#111827', card:'#1F2937', text:'#F9FAFB', textSec:'#9CA3AF', border:'#374151', input:'#374151' };

interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
  isDark: boolean;
  tc: ThemeColors;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light', setTheme: () => {}, isDark: false, tc: LIGHT,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const storageKey = `theme:${user?.id ?? 'default'}`;
  const [theme, setThemeState] = useState<AppTheme>('light');

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(storageKey)
      .then(v => {
        if (!live) return;
        setThemeState(v === 'light' || v === 'dark' ? v : 'light');
      })
      .catch(() => {});
    return () => { live = false; };
  }, [storageKey]);

  const setTheme = useCallback(async (t: AppTheme) => {
    setThemeState(t);
    try { await AsyncStorage.setItem(storageKey, t); } catch {}
  }, [storageKey]);

  const value: ThemeContextValue = {
    theme, setTheme, isDark: theme === 'dark', tc: theme === 'dark' ? DARK : LIGHT,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
