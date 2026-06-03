// Laizer — Per-user theme hook (light / dark)
// Persists each user's preference in AsyncStorage keyed by their user ID.
// Changes only affect the currently signed-in user's session.
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/authStore';

export type AppTheme = 'light' | 'dark';

/** Colour tokens that flip with the theme */
export interface ThemeColors {
  bg:      string;
  card:    string;
  text:    string;
  textSec: string;
  border:  string;
  input:   string;
}

const LIGHT: ThemeColors = {
  bg:      '#F9FAFB',
  card:    '#FFFFFF',
  text:    '#111827',
  textSec: '#6B7280',
  border:  '#E5E7EB',
  input:   '#FFFFFF',
};
const DARK: ThemeColors = {
  bg:      '#111827',
  card:    '#1F2937',
  text:    '#F9FAFB',
  textSec: '#9CA3AF',
  border:  '#374151',
  input:   '#374151',
};

export function useTheme() {
  const { user } = useAuthStore();
  const storageKey = `theme:${user?.id ?? 'default'}`;
  const [theme, setThemeState] = useState<AppTheme>('light');

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then(v => { if (v === 'light' || v === 'dark') setThemeState(v); })
      .catch(() => {});
  }, [storageKey]);

  const setTheme = useCallback(async (t: AppTheme) => {
    setThemeState(t);
    try { await AsyncStorage.setItem(storageKey, t); } catch {}
  }, [storageKey]);

  return {
    theme,
    setTheme,
    isDark: theme === 'dark',
    tc: theme === 'dark' ? DARK : LIGHT,
  };
}
