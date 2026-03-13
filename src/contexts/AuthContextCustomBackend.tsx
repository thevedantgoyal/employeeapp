/**
 * AuthContext that uses the Node.js backend instead of Supabase.
 * Use this when VITE_USE_CUSTOM_BACKEND=true.
 * Same interface as AuthContext (user, session, loading, signUp, signIn, signOut, resetPassword).
 */

import { createContext, useContext, useEffect, useState } from "react";
import { authApi, setAuthTokens, clearAuth } from "@/integrations/api/client";

function getStoredToken(): string | null {
  return localStorage.getItem("connectplus_access_token");
}

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
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null; user?: CustomUser | null }>;
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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [session, setSession] = useState<CustomSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (cancelled) return;
      setLoading(false);
    }, 8000);

    authApi
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.user) {
          setUser(null);
          setSession(null);
        } else {
          const token = getStoredToken();
          setUser(data.user as CustomUser);
          setSession({
            access_token: token ?? "",
            user: data.user as { id: string; email: string },
          });
        }
        setLoading(false);
        clearTimeout(timeout);
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setSession(null);
          setLoading(false);
          clearTimeout(timeout);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await authApi.signUp(email, password, fullName);
    if (error) return { error: new Error(error.message), user: null };
    if (data?.user && data?.session) {
      setAuthTokens(data.session.access_token, data.session.refresh_token);
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

  const signIn = async (email: string, password: string) => {
    const { data, error } = await authApi.signIn(email, password);
    if (error) return { error: new Error(error.message), user: null };
    if (data?.user && data?.session) {
      setAuthTokens(data.session.access_token, data.session.refresh_token);
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
    clearAuth();
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
      setUser(data.user as CustomUser);
      const token = getStoredToken();
      if (token) setSession({ access_token: token, user: data.user as { id: string; email: string } });
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithMicrosoft, signOut, resetPassword, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};
