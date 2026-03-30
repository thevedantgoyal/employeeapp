/**
 * Single source for the Node API base URL (includes `/api` prefix).
 * Vite inlines `VITE_API_URL` at build time. In production, when unset, use same-origin `/api` (typical behind nginx).
 */
export function getApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv != null && String(fromEnv).trim() !== "") {
    return String(fromEnv).trim().replace(/\/$/, "");
  }
  if (import.meta.env.PROD) return "/api";
  return "http://localhost:4000/api";
}
