/**
 * API client for ConnectPlus Node.js backend.
 * Use when VITE_USE_CUSTOM_BACKEND=true. Same response shape as Supabase: { data, error }.
 */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function getToken(): string | null {
  return localStorage.getItem('connectplus_access_token');
}

function getRefreshToken(): string | null {
  return localStorage.getItem('connectplus_refresh_token');
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem('connectplus_access_token', access);
  localStorage.setItem('connectplus_refresh_token', refresh);
}

function clearTokens() {
  localStorage.removeItem('connectplus_access_token');
  localStorage.removeItem('connectplus_refresh_token');
}

export async function refreshSession(): Promise<{ access_token: string; refresh_token: string; user: { id: string; email: string } } | null> {
  try {
    const refresh = getRefreshToken();
    if (!refresh) return null;
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    const json = await res.json().catch(() => ({}));
    if (json.error || !json.data?.session) return null;
    const session = json.data.session;
    setTokens(session.access_token, session.refresh_token);
    return session;
  } catch {
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
    if (!skipAuth) {
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const method = (fetchOptions.method || 'GET').toUpperCase();
    const requestInit: RequestInit = { ...fetchOptions, headers };
    if (method === 'GET') requestInit.cache = 'no-store';
    let res = await fetch(url, requestInit);
    if (res.status === 401 && !skipAuth && getRefreshToken()) {
      const session = await refreshSession();
      if (session) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
        res = await fetch(url, requestInit);
      }
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
    return { data: json.data ?? null, error: json.error || null };
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

export function setAuthTokens(accessToken: string, refreshToken: string) {
  setTokens(accessToken, refreshToken);
}

export function clearAuth() {
  clearTokens();
}
