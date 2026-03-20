/**
 * Database/API client for the Node.js backend (PostgreSQL).
 * Replaces the previous Supabase client; same API shape for compatibility.
 */
import { api, authApi } from "@/integrations/api/client";

const DATA_PREFIX = "/data";
const PROFILES_ME = "/profiles/me";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const CREDENTIALS: RequestCredentials = "include";

type QueryParams = Record<string, string | string[] | number | number[] | boolean | undefined>;

function buildParams(filters: QueryParams): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) out[k] = v.map(String);
    else out[k] = String(v);
  }
  return out;
}

function createBuilder(table: string) {
  let selectCols: string | undefined;
  const params: QueryParams = {};
  let orderCol: string | undefined;
  let orderAsc = false;
  let single = false;
  let maybeSingle = false;
  let limitNum: number | undefined;

  const run = async (method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown) => {
    // Only use /profiles/me when fetching current user's profile (single user_id). Batch fetch by .in("user_id", ids) must go to data API.
    const profileGetWithUserId = table === "profiles" && method === "GET" && "user_id" in params && Object.keys(params).length <= 2;
    const userIdParam = params.user_id;
    const isBatchUserIds = Array.isArray(userIdParam) && userIdParam.length > 0;
    if (profileGetWithUserId && !isBatchUserIds) {
      const { data, error } = await api.get<unknown>(PROFILES_ME);
      return { data: single || maybeSingle ? data : data != null ? [data] : [], error };
    }
    if (table === "profiles" && method === "PATCH" && "user_id" in params) {
      const { data, error } = await api.patch<unknown>(PROFILES_ME, body);
      return { data, error };
    }
    const path = `${DATA_PREFIX}/${table}`;
    if (method === "GET") {
      const q: QueryParams = { ...params };
      if (orderCol) q.order = orderCol;
      q.ascending = orderAsc ? "true" : "false";
      if (limitNum != null) q.limit = String(limitNum);
      const { data, error } = await api.get<unknown[]>(path, buildParams(q));
      if (error) return { data: null, error };
      const result = data ?? [];
      if (single) return { data: result[0] ?? null, error: result[0] == null ? { message: "No rows" } : null };
      if (maybeSingle) return { data: result[0] ?? null, error: null };
      return { data: result, error: null };
    }
    if (method === "POST") {
      const { data, error } = await api.post<unknown>(path, body);
      return { data, error };
    }
    if (method === "PATCH") {
      const id = params.id ?? params.user_id;
      // Tasks table requires id in query; missing id causes 400
      if (table === "tasks" && (id == null || id === "")) {
        return { data: null, error: { message: "Task update requires task id (use .eq('id', taskId) before update)" } };
      }
      const q = id != null ? (typeof id === "string" ? { id } : { user_id: id }) : {};
      const queryString = new URLSearchParams(buildParams(q) as Record<string, string>).toString();
      const fullPath = queryString ? `${path}?${queryString}` : path;
      const { data, error } = await api.patch<unknown>(fullPath, body);
      return { data, error };
    }
    if (method === "DELETE") {
      const id = params.id;
      const q = id != null ? { id: String(id) } : {};
      const { data, error } = await api.delete<unknown>(`${path}?${new URLSearchParams(buildParams(q) as Record<string, string>).toString()}`);
      return { data, error };
    }
    return { data: null, error: { message: "Unknown method" } };
  };

  const chain = {
    select: (cols?: string) => {
      selectCols = cols;
      return chain;
    },
    eq: (col: string, val: string | number | boolean) => {
      params[col] = val;
      return chain;
    },
    in: (col: string, vals: string[] | number[]) => {
      params[col] = vals;
      return chain;
    },
    neq: (col: string, val: string) => {
      params[`${col}_neq`] = val;
      return chain;
    },
    order: (col: string, opts?: { ascending?: boolean }) => {
      orderCol = col;
      orderAsc = opts?.ascending ?? false;
      return chain;
    },
    single: () => {
      single = true;
      return chain;
    },
    maybeSingle: () => {
      maybeSingle = true;
      return chain;
    },
    limit: (n: number) => {
      limitNum = n;
      return chain;
    },
    insert: (data: object | object[]) => {
      const payload = Array.isArray(data) ? data : [data];
      const path = `${DATA_PREFIX}/${table}`;
      return {
        select: () => ({
          single: () => run("POST", payload[0]).then((r) => ({ ...r, data: r.data ?? payload[0] })),
          then: (onFulfilled: (r: { data: unknown; error: { message: string } | null }) => unknown, onRejected?: (e: unknown) => unknown) =>
            api.post<unknown>(path, payload[0]).then((res) => onFulfilled({ data: res.data, error: res.error }) as Promise<unknown>, onRejected),
        }),
        then: (onFulfilled: (r: { data: unknown; error: { message: string } | null }) => unknown, onRejected?: (e: unknown) => unknown) =>
          api.post<unknown>(path, payload[0]).then((res) => onFulfilled({ data: res.data, error: res.error }) as Promise<unknown>, onRejected),
      };
    },
    upsert: (data: object | object[], _opts?: { onConflict?: string }) => {
      const payload = Array.isArray(data) ? data : [data];
      const row = payload[0] as Record<string, unknown>;
      if (table !== "push_subscriptions" || !row?.user_id || !row?.endpoint) {
        return {
          then: (onFulfilled: (r: { data: unknown; error: { message: string } | null }) => unknown) =>
            run("POST", row).then((r) => onFulfilled(r as { data: unknown; error: { message: string } | null }) as Promise<unknown>),
        };
      }
      const runUpsert = async () => {
        const res = await api.get<{ data?: unknown[] }>(`${DATA_PREFIX}/${table}`, { user_id: String(row.user_id), endpoint: String(row.endpoint) });
        const list = res.data?.data ?? [];
        if (list.length > 0 && list[0] && typeof list[0] === "object" && "id" in list[0]) {
          const id = (list[0] as { id: string }).id;
          const out = await api.patch<unknown>(`${DATA_PREFIX}/${table}?id=${encodeURIComponent(id)}`, row);
          return { data: out.data, error: out.error };
        }
        const out = await api.post<unknown>(`${DATA_PREFIX}/${table}`, row);
        return { data: out.data, error: out.error };
      };
      return {
        then: (onFulfilled: (r: { data: unknown; error: { message: string } | null }) => unknown) =>
          runUpsert().then((r) => onFulfilled(r as { data: unknown; error: { message: string } | null }) as Promise<unknown>),
      };
    },
    update: (data: object) => {
      const patchReturn = {
        eq: (col: string, val: string | number) => {
          params[col] = val;
          return patchReturn;
        },
        select: () => ({ single: () => run("PATCH", data) }),
        then: (onFulfilled: (r: { data: unknown; error: { message: string } | null }) => unknown) => run("PATCH", data).then(onFulfilled as (r: unknown) => unknown),
        is: (col: string, val: null | unknown) => {
          params[`${col}_is_null`] = val === null ? "true" : "false";
          return patchReturn;
        },
      };
      return {
        eq: patchReturn.eq,
        select: patchReturn.select,
        then: patchReturn.then,
      };
    },
    delete: () => ({
      eq: (col: string, val: string | number) => {
        params[col] = val;
        return { then: (onFulfilled: (r: { data: unknown; error: { message: string } | null }) => unknown) => run("DELETE").then(onFulfilled as (r: unknown) => unknown) };
      },
      then: (onFulfilled: (r: { data: unknown; error: { message: string } | null }) => unknown) => run("DELETE").then(onFulfilled as (r: unknown) => unknown),
    }),
    then: (onFulfilled: (r: { data: unknown; error: { message: string } | null }) => unknown, onRejected?: (e: unknown) => unknown) =>
      run("GET").then((r) => onFulfilled(r) as Promise<unknown>, onRejected),
  };
  return chain;
}

async function invokeAdmin(name: string, args: Record<string, unknown>) {
  const body = (args?.body as Record<string, unknown>) ?? args;
  if (name === "admin-manage") {
    const res = await api.post<Record<string, unknown>>("/admin/action", body);
    return { data: res.data ?? null, error: res.error };
  }
  if (name === "bulk-onboard") {
    const res = await api.post<Record<string, unknown>>("/admin/bulk-onboard", body);
    return { data: res.data ?? null, error: res.error };
  }
  if (name === "admin-api-fetch") {
    const res = await api.post<Record<string, unknown>>("/admin/api-fetch", body);
    return { data: res.data ?? null, error: res.error };
  }
  if (name === "admin-import-employees-from-api") {
    const res = await api.post<Record<string, unknown>>("/admin/import-employees-from-api", body);
    return { data: res.data ?? null, error: res.error };
  }
  if (name === "admin-reset-database") {
    const res = await api.post<Record<string, unknown>>("/admin/reset-database", body);
    return { data: res.data ?? null, error: res.error };
  }
  return { data: null, error: { message: `Unknown function: ${name}` } };
}

export const db = {
  from: (table: string) => createBuilder(table),
  auth: {
    getSession: async () => {
      const { data, error } = await authApi.getSession();
      if (error || !data?.user) return { data: { session: null }, error: error ?? null };
      const session = {
        access_token: "httpOnly",
        refresh_token: "",
        user: data.user as { id: string; email: string },
        expires_in: 3600,
      };
      return { data: { session }, error: null };
    },
    getUser: async () => {
      const { data, error } = await authApi.getSession();
      if (error) return { data: { user: null }, error };
      return { data: { user: data?.user ?? null }, error: null };
    },
  },
  rpc: (fn: string, args: Record<string, unknown>) => {
    if (fn === "approve_leave") return api.post(`/leaves/${args._leave_id}/approve`, { comment: args._approver_comment ?? null });
    if (fn === "reject_leave") return api.post(`/leaves/${args._leave_id}/reject`, { comment: args._approver_comment ?? null });
    if (fn === "check_booking_conflict") return api.post("/rpc/check_booking_conflict", args);
    if (fn === "check_leave_overlap") return api.post("/rpc/check_leave_overlap", args);
    if (fn === "create_notification") return api.post("/rpc/create_notification", args);
    if (fn === "setup_first_admin") return api.post("/auth/setup-first-admin", { setupCode: args._setup_code });
    return Promise.resolve({ data: null, error: { message: "Unknown RPC" } });
  },
  functions: {
    invoke: async (name: string, args: Record<string, unknown> = {}) => {
      if (name === "admin-manage" || name === "bulk-onboard" || name === "admin-api-fetch" || name === "admin-import-employees-from-api" || name === "admin-reset-database") return invokeAdmin(name, args);
      if (name === "send-email" || name === "send-broadcast" || name === "send-push") {
        return { data: null, error: { message: `${name} is not implemented on the backend yet` } };
      }
      return { data: null, error: { message: `Unknown function: ${name}` } };
    },
  },
  storage: {
    from: (bucket: string) => ({
      upload: async (path: string, file: File) => {
        const form = new FormData();
        form.append("bucket", bucket);
        form.append("path", path);
        form.append("file", file);
        const res = await fetch(`${API_BASE}/storage/upload`, {
          method: "POST",
          credentials: CREDENTIALS,
          body: form,
        });
        const json = await res.json();
        if (!res.ok) return { data: null, error: { message: json.error?.message || "Upload failed" } };
        // Avatar upload returns Base64 data URI in avatar_url; use it as url so img src works everywhere
        const url = (json.data && json.data.avatar_url) ? json.data.avatar_url : `${API_BASE.replace(/\/api$/, "")}/api/storage/${bucket}/${encodeURIComponent(path)}`;
        return { data: { path, url }, error: null };
      },
      getPublicUrl: (path: string) => {
        return { data: { publicUrl: `${API_BASE.replace(/\/api$/, "")}/api/storage/${bucket}/${encodeURIComponent(path)}` } };
      },
      createSignedUrl: async (_path: string, _expiresIn: number) => {
        return { data: { signedUrl: `${API_BASE.replace(/\/api$/, "")}/api/storage/${bucket}/${encodeURIComponent(_path)}` }, error: null };
      },
      remove: async (paths: string[]) => {
        for (const p of paths) {
          await fetch(`${API_BASE}/storage/${bucket}/${encodeURIComponent(p)}`, { method: "DELETE", credentials: CREDENTIALS });
        }
        return { data: null, error: null };
      },
    }),
  },
};
