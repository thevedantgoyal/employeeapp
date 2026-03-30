/**
 * Browser-based session helpers (non-secret metadata only; auth tokens stay in httpOnly cookies).
 * - sessionStorage: per-tab session marker (tab scope)
 * - Cross-tab logout: localStorage + storage event (fires only in *other* tabs, not the tab that signed out)
 */

const SESSION_STORAGE_KEY = "connectplus.app.browserSession";
const LOGOUT_BROADCAST_KEY = "connectplus.auth.logoutBroadcast";

export interface BrowserSessionMeta {
  id: string;
  createdAt: number;
}

export function createBrowserSession(): BrowserSessionMeta {
  if (typeof window === "undefined") {
    return { id: "", createdAt: 0 };
  }
  const meta: BrowserSessionMeta = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // quota / private mode
  }
  return meta;
}

export function getBrowserSession(): BrowserSessionMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BrowserSessionMeta;
  } catch {
    return null;
  }
}

export function ensureBrowserSession(): BrowserSessionMeta {
  const existing = getBrowserSession();
  if (existing) return existing;
  return createBrowserSession();
}

export function clearBrowserSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Notify other tabs that sign-out completed (httpOnly cookies are cleared for the whole browser).
 * The tab that calls this does not receive the storage event.
 */
export function broadcastLogoutToOtherTabs(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOGOUT_BROADCAST_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/**
 * Subscribe to cross-tab logout (other tabs only). Returns unsubscribe.
 */
export function subscribeCrossTabLogout(onLogout: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (e: StorageEvent) => {
    if (e.key === LOGOUT_BROADCAST_KEY && e.newValue) onLogout();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
