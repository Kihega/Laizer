/**
 * SMSS — useAuth hook
 */
import { useState, useCallback } from 'react';
import { authService }              from '@/services/api';
import { useAuthStore, SmssUser }    from '@/store/authStore';

export interface AuthError { code: string; message: string; }
interface LoginResult { success: boolean; role?: string; error?: AuthError; }

export function useAuth() {
  const { setAuth, clearAuth, refreshToken, user, isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<AuthError | null>(null);

  const ownerLogin = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true); setError(null);
    try {
      const { data } = await authService.ownerLogin(email.trim(), password);
      await setAuth(data.access, data.refresh, data.user as SmssUser);
      return { success: true, role: data.user.role };
    } catch (err) {
      const resp = (err as any)?.response?.data;
      const e: AuthError = { code: resp?.error ?? 'network_error', message: resp?.detail ?? 'Could not connect to server.' };
      setError(e);
      return { success: false, error: e };
    } finally { setIsLoading(false); }
  }, [setAuth]);

  const workerLogin = useCallback(async (centreId: string): Promise<LoginResult> => {
    setIsLoading(true); setError(null);
    try {
      const { data } = await authService.workerLogin(centreId.trim());
      await setAuth(data.access, data.refresh, data.user as SmssUser);
      return { success: true, role: data.user.role };
    } catch (err) {
      const resp = (err as any)?.response?.data;
      const e: AuthError = { code: resp?.error ?? 'network_error', message: resp?.detail ?? 'Could not connect to server.' };
      setError(e);
      return { success: false, error: e };
    } finally { setIsLoading(false); }
  }, [setAuth]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } catch { /* clear local regardless */ }
    finally { await clearAuth(); setIsLoading(false); }
  }, [refreshToken, clearAuth]);

  return {
    user, isAuthenticated, isLoading, error,
    clearError: () => setError(null),
    ownerLogin, workerLogin, logout,
  };
}
