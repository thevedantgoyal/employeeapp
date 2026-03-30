/**
 * AuthContext that uses the Node.js backend instead of Supabase.
 * Use this when VITE_USE_CUSTOM_BACKEND=true.
 * Same interface as AuthContext (user, session, loading, signIn, signOut, resetPassword). Signup removed.
 * Auth uses httpOnly cookies; no tokens in localStorage.
 */

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { authApi, setAuthTokens, clearAuth } from "@/integrations/api/client";
import { clearStaleLocalhostAuthStorage } from "@/lib/authStorageCleanup";
import {
  broadcastLogoutToOtherTabs,
  clearBrowserSession,
  ensureBrowserSession,
  subscribeCrossTabLogout,
} from "@/lib/browserSession";

export interface CustomUser {
  id: string;
  email: string;
  first_login?: boolean;
  role?: string;
  external_role?: string | null;
  external_sub_role?: string | null;
  userType?: "EMPLOYEE" | "MANAGER" | "SENIOR_MANAGER" | string;
  manager_id?: string | null;
  user_metadata?: { full_name?: string };
}

export interface CustomSession {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user: {
    id: string;
    email: string;
    first_login?: boolean;
    role?: string;
    external_role?: string | null;
    external_sub_role?: string | null;
    userType?: string;
    manager_id?: string | null;
  };
}

interface AuthContextType {
  user: CustomUser | null;
  session: CustomSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; user?: CustomUser | null }>;
  signInWithMicrosoft: (idToken: string) => Promise<{ error: Error | null; user?: CustomUser | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

const VISIBILITY_SESSION_REFRESH_MS = 45_000;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [session, setSession] = useState<CustomSession | null>(null);
  const [loading, setLoading] = useState(true);
  const lastVisibilityRefresh = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 8000);

    (async () => {
      try {
        const { data, error } = await authApi.getSession();
        if (cancelled) return;
        if (error || !data?.user) {
          setUser(null);
          setSession(null);
          clearBrowserSession();
          await clearAuth();
          clearStaleLocalhostAuthStorage();
        } else {
          ensureBrowserSession();
          setUser(data.user as CustomUser);
          setSession({
            access_token: "httpOnly",
            user: data.user as { id: string; email: string },
          });
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setSession(null);
          clearBrowserSession();
          await clearAuth();
          clearStaleLocalhostAuthStorage();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          clearTimeout(timeout);
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  /** Other tabs signed out — cookies are already cleared on this origin; sync React state. */
  useEffect(() => {
    return subscribeCrossTabLogout(() => {
      setUser(null);
      setSession(null);
      clearBrowserSession();
      if (window.location.pathname !== "/auth") {
        window.location.href = "/auth";
      }
    });
  }, []);

  /** When the tab becomes visible, re-check session (cookie refresh + server state) on an interval. */
  useEffect(() => {
    if (!user) return;

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastVisibilityRefresh.current < VISIBILITY_SESSION_REFRESH_MS) return;
      lastVisibilityRefresh.current = now;

      void authApi.getSession().then(({ data, error }) => {
        if (error || !data?.user) {
          setUser(null);
          setSession(null);
          clearBrowserSession();
        } else {
          ensureBrowserSession();
          setUser(data.user as CustomUser);
          setSession({
            access_token: "httpOnly",
            user: data.user as { id: string; email: string },
          });
        }
      });
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await authApi.signIn(email, password);
    if (error) return { error: new Error(error.message), user: null };
    if (data?.user && data?.session) {
      setAuthTokens(data.session.access_token, data.session.refresh_token);
      ensureBrowserSession();
      const u = ({ ...(data.user as CustomUser), ...(data.session.user as Record<string, unknown>) } as CustomUser);
      setUser(u);
      setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        user: data.session.user,
      });
      return { error: null, user: u };
    }
    return { error: null, user: null };
  };

  const signInWithMicrosoft = async (idToken: string) => {
    const { data, error } = await authApi.signInWithMicrosoft(idToken);
    if (error) return { error: new Error(error.message), user: null };
    if (data?.user && data?.session) {
      setAuthTokens(data.session.access_token, data.session.refresh_token);
      ensureBrowserSession();
      const u = ({ ...(data.user as CustomUser), ...(data.session.user as Record<string, unknown>) } as CustomUser);
      setUser(u);
      setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        user: data.session.user,
      });
      return { error: null, user: u };
    }
    return { error: null, user: null };
  };

  const signOut = async () => {
    await authApi.signOut();
    await clearAuth();
    broadcastLogoutToOtherTabs();
    clearBrowserSession();
    setUser(null);
    setSession(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await authApi.resetPassword(email);
    return { error: error ? new Error(error.message) : null };
  };

  const refreshSession = async () => {
    const { data, error } = await authApi.getSession();
    if (!error && data?.user) {
      ensureBrowserSession();
      setUser(data.user as CustomUser);
      setSession({ access_token: "httpOnly", user: data.user as { id: string; email: string } });
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signInWithMicrosoft, signOut, resetPassword, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};
