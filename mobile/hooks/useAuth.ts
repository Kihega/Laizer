/**
 * SMSS — useAuth hook
 * __LAIZER_PATCH_V12__ — login failures are turned into short, plain-language
 * messages (no HTTP status codes) that the login screen shows in an alert card.
 */
import { useState, useCallback } from 'react';
import { authService }              from '@/services/api';
import { useAuthStore, SmssUser }    from '@/store/authStore';

export interface AuthError { code: string; title: string; message: string; }
interface LoginResult { success: boolean; role?: string; error?: AuthError; notice?: string | null; }

// __LAIZER_PATCH_V10__
// Guarantees the login spinner can never spin forever: if the request
// hasn't settled within 20s (dropped connection, unexpected server
// hang, etc.) this rejects with a normal network-style error so the
// existing catch block below shows it instead of leaving the button
// stuck on "loading".
function withLoginTimeout<T>(promise: Promise<T>, ms = 20000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject({
      response: { data: { error: 'timeout', detail: 'This is taking too long. Check your connection and try again.' } },
    }), ms)),
  ]);
}

// Worker-login error codes (backend routes/auth.js) -> plain wording.
const WORKER_MESSAGES: Record<string, string> = {
  invalid_worker_id: 'Wrong Worker ID. Check it and try again.',
  invalid_centre_id: 'Wrong Centre ID. Check it and try again.',
  centre_mismatch:   'This Worker ID does not belong to that Centre ID.',
  worker_id_required:'Enter your Worker ID to continue.',
  not_assigned:      'You are not assigned to a centre yet. Contact your employer.',
};

/** Turn any login failure into { title, message } — never exposes status codes. */
function toAuthError(err: unknown, role: 'owner' | 'worker'): AuthError {
  const e      = err as any;
  const resp   = e?.response;
  const data   = resp?.data;
  const status = resp?.status as number | undefined;
  const code   = (data?.error as string | undefined) ?? '';

  // Backend unreachable / offline / timed out
  if (!resp || code === 'network_error' || code === 'timeout' || e?.message === 'Network Error') {
    return { code: code || 'network_error', title: 'Connection error', message: 'Check your internet connection and try again.' };
  }

  if (status === 429 || code === 'too_many_requests') {
    return { code, title: 'Login failed', message: 'Too many attempts. Please wait a few minutes and try again.' };
  }

  if (status === 400 || code === 'validation_error') {
    const fe = data?.detail?.fieldErrors;
    if (fe?.email?.length) return { code, title: 'Login failed', message: 'Enter a valid email address.' };
    return {
      code, title: 'Login failed',
      message: role === 'owner' ? 'Enter your email and password.' : 'Enter your Centre ID (and Worker ID).',
    };
  }

  if (status === 401 || status === 403) {
    if (role === 'owner') return { code, title: 'Login failed', message: 'Wrong email or password.' };
    return { code, title: 'Login failed', message: WORKER_MESSAGES[code] ?? 'Wrong Worker ID or Centre ID.' };
  }

  // 5xx, database trouble, anything unexpected
  return { code: code || 'server_error', title: 'Server error', message: 'Something went wrong on our side. Please try again in a moment.' };
}

export function useAuth() {
  const { setAuth, clearAuth, refreshToken, user, isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<AuthError | null>(null);

  const ownerLogin = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true); setError(null);
    try {
      const { data } = await withLoginTimeout(authService.ownerLogin(email.trim(), password));
      await setAuth(data.access, data.refresh, data.user as SmssUser);
      if (data.centreInfo) useAuthStore.getState().setCentreInfo(data.centreInfo);
      return { success: true, role: data.user.role };
    } catch (err) {
      const e = toAuthError(err, 'owner');
      setError(e);
      return { success: false, error: e };
    } finally { setIsLoading(false); }
  }, [setAuth]);

  const workerLogin = useCallback(async (workerId: string, centreId: string): Promise<LoginResult> => { // __LAIZER_PATCH_V9__
    setIsLoading(true); setError(null);
    try {
      const { data } = await withLoginTimeout(authService.workerLogin(workerId.trim(), centreId.trim()));
      await setAuth(data.access, data.refresh, data.user as SmssUser);
      if (data.centreInfo) useAuthStore.getState().setCentreInfo(data.centreInfo);
      return { success: true, role: data.user.role, notice: data.notice ?? null };
    } catch (err) {
      const e = toAuthError(err, 'worker');
      setError(e);
      return { success: false, error: e };
    } finally { setIsLoading(false); }
  }, [setAuth]);

  // __LAIZER_PATCH_V17__ — sign out instantly: clear the local session first, then
  // tell the server in the background. Waiting for the server made the button
  // "just load" whenever the connection was slow or the server was waking up.
  const logout = useCallback(async () => {
    const token = refreshToken;
    await clearAuth();
    if (token) authService.logout(token).catch(() => { /* already signed out locally */ });
  }, [refreshToken, clearAuth]);

  return {
    user, isAuthenticated, isLoading, error,
    clearError: () => setError(null),
    ownerLogin, workerLogin, logout,
  };
}
