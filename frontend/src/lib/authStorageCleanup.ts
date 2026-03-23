/**
 * Hosted production hostname for ConnectPlus employee app.
 * Clears client-side storage entries that still reference local dev URLs.
 */
const HOSTED_CONNECTPLUS_HOSTNAME = "connectplus-employee.onrender.com";

export function isHostedConnectPlusDomain(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname === HOSTED_CONNECTPLUS_HOSTNAME;
}

function mentionsLocalDev(s: string): boolean {
  const lower = s.toLowerCase();
  return lower.includes("localhost") || lower.includes("127.0.0.1");
}

/**
 * Remove localStorage / sessionStorage entries whose keys or values reference localhost.
 * Also clears non-httpOnly cookies on the current origin that reference localhost (readable names/values).
 */
export function clearStaleLocalhostAuthStorage(): void {
  if (typeof window === "undefined") return;
  try {
    for (const storage of [localStorage, sessionStorage]) {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key) continue;
        const val = storage.getItem(key) ?? "";
        if (mentionsLocalDev(key) || mentionsLocalDev(val)) {
          keys.push(key);
        }
      }
      keys.forEach((k) => storage.removeItem(k));
    }

    const raw = document.cookie;
    if (raw) {
      for (const segment of raw.split(";")) {
        const trimmed = segment.trim();
        if (!trimmed) continue;
        const eq = trimmed.indexOf("=");
        const name = (eq >= 0 ? trimmed.slice(0, eq) : trimmed).trim();
        const value = eq >= 0 ? trimmed.slice(eq + 1) : "";
        if (mentionsLocalDev(name) || mentionsLocalDev(value)) {
          const enc = encodeURIComponent(name);
          document.cookie = `${enc}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
          document.cookie = `${enc}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/api`;
        }
      }
    }
  } catch {
    // ignore quota / security errors
  }
}

/** Run localhost-stale cleanup once on production host (before app shell). */
export function runHostedAuthCleanupIfNeeded(): void {
  if (isHostedConnectPlusDomain()) {
    clearStaleLocalhostAuthStorage();
  }
}
