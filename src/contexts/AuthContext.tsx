/**
 * Re-exports from custom backend (PostgreSQL via Node.js).
 * Supabase auth is no longer used.
 */
export { useAuth, AuthProvider } from "@/contexts/AuthContextCustomBackend";
export type { CustomUser as User, CustomSession as Session } from "@/contexts/AuthContextCustomBackend";
