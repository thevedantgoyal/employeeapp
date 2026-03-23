/**
 * API client for ConnectPlus Node.js backend.
 * Use when VITE_USE_CUSTOM_BACKEND=true. Same response shape as Supabase: { data, error }.
 * Auth uses httpOnly cookies; no tokens stored in localStorage (XSS-safe).
 */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const DEFAULT_FETCH_OPTIONS: RequestInit = { credentials: 'include' };

/** After a failed refresh, skip further refresh attempts for this long (avoids 401/429 loops). */
const REFRESH_FAIL_COOLDOWN_MS = 60_000;
let refreshSessionCooldownUntil = 0;

export async function refreshSession(): Promise<{ access_token: string; refresh_token: string; user: { id: string; email: string } } | null> {
  if (Date.now() < refreshSessionCooldownUntil) {
    return null;
  }
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      ...DEFAULT_FETCH_OPTIONS,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const json = await res.json().catch(() => ({}));
    if (json.error || !json.data?.session) {
      refreshSessionCooldownUntil = Date.now() + REFRESH_FAIL_COOLDOWN_MS;
      return null;
    }
    refreshSessionCooldownUntil = 0;
    return json.data.session;
  } catch {
    refreshSessionCooldownUntil = Date.now() + REFRESH_FAIL_COOLDOWN_MS;
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {}
): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const { skipAuth, ...fetchOptions } = options;
    const url = path.startsWith('http') ? path : `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((fetchOptions.headers as Record<string, string>) || {}),
    };
    const method = (fetchOptions.method || 'GET').toUpperCase();
    const requestInit: RequestInit = { ...DEFAULT_FETCH_OPTIONS, ...fetchOptions, headers };
    if (method === 'GET') requestInit.cache = 'no-store';
    let res = await fetch(url, requestInit);
    if (res.status === 401 && !skipAuth) {
      const session = await refreshSession();
      if (session) res = await fetch(url, requestInit);
    }
    const text = await res.text();
    let json: { data?: T; error?: { message?: string } };
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      return { data: null, error: { message: res.statusText || 'Network error' } };
    }
    if (!res.ok) {
      return { data: null, error: { message: json.error?.message || res.statusText || 'Request failed' } };
    }
    const error = json.error ? { message: json.error.message ?? 'Request failed' } : null;
    return { data: json.data ?? null, error };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { data: null, error: { message } };
  }
}

export const api = {
  get: <T = unknown>(path: string, params?: Record<string, string | string[] | undefined>) => {
    const q = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<T>(q ? `${path}?${q}` : path, { method: 'GET' });
  },
  post: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = unknown>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export const authApi = {
  signIn: (email: string, password: string) =>
    request<{ user: { id: string; email: string; first_login?: boolean; user_metadata?: { full_name?: string } }; session: { access_token: string; refresh_token: string; user: { id: string; email: string; first_login?: boolean; role?: string; external_role?: string | null; external_sub_role?: string | null; userType?: string; manager_id?: string | null }; expires_in: number } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }), skipAuth: true }
    ),
  signInWithMicrosoft: (idToken: string) =>
    request<{ user: { id: string; email: string; first_login?: boolean; user_metadata?: { full_name?: string } }; session: { access_token: string; refresh_token: string; user: { id: string; email: string; first_login?: boolean; role?: string; external_role?: string | null; external_sub_role?: string | null; userType?: string; manager_id?: string | null }; expires_in: number } }>(
      '/auth/microsoft',
      { method: 'POST', body: JSON.stringify({ id_token: idToken }), skipAuth: true }
    ),
  getSession: () =>
    request<{ user: { id: string; email: string; first_login?: boolean; role?: string; external_role?: string | null; external_sub_role?: string | null; userType?: string; manager_id?: string | null; user_metadata?: { full_name?: string } }; profile: unknown }>('/auth/session'),
  signOut: () => api.post('/auth/logout'),
  resetPassword: (email: string) =>
    api.post('/auth/reset-password', { email }),
  updatePassword: (password: string) =>
    api.put('/auth/password', { password }),
  refresh: refreshSession,
};

/** No-op: tokens are in httpOnly cookies. Kept for API compatibility. */
export function setAuthTokens(_accessToken: string, _refreshToken: string) {}

/** Clears auth by calling logout endpoint (clears httpOnly cookies server-side). */
export async function clearAuth() {
  try {
    await fetch(`${BASE}/auth/logout`, { ...DEFAULT_FETCH_OPTIONS, method: 'POST', headers: { 'Content-Type': 'application/json' } });
  } catch {
    // ignore
  }
}
