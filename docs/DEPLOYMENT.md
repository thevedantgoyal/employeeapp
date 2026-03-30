# ConnectPlus / EmployeeApp — deployment and root causes

This document maps common production failures to **why** they happen and what this repo does to mitigate them.

## 1. Environment variables not loading (PM2 / Node)

**Symptom:** `DATABASE_URL` missing at runtime, DB connection errors, auth failures.

**Root cause:** Node does not load `.env` automatically. This app loads it in [`backend/src/config/index.js`](../backend/src/config/index.js) from (1) `process.cwd()/.env` and (2) `backend/.env` resolved from the config module path. If PM2 starts the process with a **working directory** that does not contain `.env`, and the file is not found via the second path, variables stay empty.

**Mitigation in repo:** Explicit `dotenv` loading + startup check that exits with a clear message if `DATABASE_URL` is unset ([`validateStartupEnv`](../backend/src/config/index.js)).

**Operations:** Set `cwd` in PM2 to the `backend` folder (see [`backend/ecosystem.config.cjs`](../backend/ecosystem.config.cjs)), or put secrets in the host environment / PM2 `env`. After changing env: `pm2 restart employeeapp --update-env`.

## 2. PostgreSQL SSL misconfiguration

**Symptom:** “Server does not support SSL” or TLS handshake errors against a non-SSL or local DB.

**Root cause:** The `pg` library does not apply `?sslmode=disable` from the URL by itself; the app must set the `ssl` option. Previously, any non-`localhost` host used TLS with `rejectUnauthorized: false`, which still **requires** SSL on the wire.

**Mitigation in repo:** [`backend/src/config/database.js`](../backend/src/config/database.js) sets `ssl: false` when:

- `DATABASE_SSL` is `false`, `0`, or `disable`, or  
- the URL query includes `sslmode=disable`.

Otherwise: `localhost` / `127.0.0.1` → no SSL; other hosts → `ssl: { rejectUnauthorized: false }` for typical managed Postgres.

## 3. PM2 not picking up new environment variables

**Symptom:** Old `DATABASE_URL` or secrets after editing `.env`.

**Root cause:** PM2 caches the environment from the first start. `restart` alone may not reload `.env` unless the process reads the file again on boot (this app does read `.env` on each startup, but vars **injected** only via PM2 still need `--update-env`).

**Fix:** `pm2 restart employeeapp --update-env` or define `env` in `ecosystem.config.cjs` and restart.

## 4. Frontend API base URL hardcoded to localhost

**Symptom:** Production browser calls `http://localhost:4000`, failing for users.

**Root cause:** Vite embeds `import.meta.env.VITE_*` at **build** time. If `VITE_API_URL` is unset, a fallback that points to localhost breaks production.

**Mitigation in repo:** [`frontend/src/integrations/api/baseUrl.ts`](../frontend/src/integrations/api/baseUrl.ts) uses `VITE_API_URL` when set; in production builds, if unset, it defaults to same-origin **`/api`** (works when nginx or the host forwards `/api` to the Node app).

**Operations:** For split domains (SPA on `app.example.com`, API on `api.example.com`), set `VITE_API_URL=https://api.example.com/api` **before** `npm run build`. See [`frontend/.env.example`](../frontend/.env.example).

## 5. API route prefix (`/api` vs `/api/auth`)

**Reality in this codebase:** Express mounts the app at `API_PREFIX` (default `/api`). Auth routes live under `/auth` → effective paths are **`POST /api/auth/login`**, etc. The frontend client uses paths like `/auth/login` relative to the API base that already includes `/api`.

**Root cause of confusion:** Mixing `/api/login` with `/api/auth/login`. This project standardizes on **`/api/auth/*`**.

## 6. Nginx reverse proxy

**Symptom:** 404 or wrong path for API calls.

**Root cause:** `proxy_pass` with or without a trailing slash changes how nginx strips/prefixes the URI. The backend listens on `PORT` (default **4000** in [`backend/src/index.js`](../backend/src/index.js)), not 5000, unless you override `PORT`.

**Example (same host, SPA + API):**

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:4000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Adjust the upstream port to match `PORT`. If the API is mounted at `/api` without stripping, ensure the `proxy_pass` URL matches how you want paths forwarded (see nginx docs on trailing slashes). A full example lives at [`deploy/nginx-api.example.conf`](../deploy/nginx-api.example.conf).

## 7. Invalid syntax in `.ts` (e.g. markdown backticks)

**Symptom:** Build error: `Expected ";" but found "$"`.

**Root cause:** Accidentally pasted markdown fences (`` ``` ``) into a TypeScript file.

**Mitigation:** Keep prose/docs in `.md` files; use a pre-release grep for backtick fences in `*.ts` / `*.tsx`.

## 8. Password authentication mismatch

**Symptom:** Login fails after manually inserting a user with a plain-text password.

**Root cause:** The API compares against **bcrypt** `password_hash`, not plain text.

**Mitigation:** Use seed scripts or utilities like [`backend/scripts/set-admin-password.js`](../backend/scripts/set-admin-password.js) that hash with bcrypt.

## 9. Database backup / restore version mismatch

**Symptom:** `pg_restore` / `pg_dump` errors about unsupported format versions.

**Root cause:** `pg_dump` version differs from the server or restore client major version.

**Mitigation:** Use the same major client as the server, or export plain SQL (`pg_dump -Fp`) for portability.

## 10. HTTP method for login

**Correct:** `POST /api/auth/login` with JSON body. `GET` is not supported for login.

## 11. Roles and first-login

**Symptom:** User exists but cannot use the app.

**Root cause:** Application logic may depend on `role`, `first_login`, or profile rows. These are **data/model** concerns, not transport.

**Mitigation:** Ensure users are seeded or onboarded per [`authController`](../backend/src/controllers/authController.js) session expectations.

## 12. Frontend–backend contract drift

**Symptom:** Supabase-style patterns mixed with the custom backend.

**Root cause:** Two stacks evolved; some hooks still mirror legacy shapes.

**Mitigation:** Prefer a single client ([`frontend/src/integrations/api/client.ts`](../frontend/src/integrations/api/client.ts)) and `db` wrapper for table access; align response shapes with `{ data, error }` from the backend.

## Health check

**Endpoint:** `GET /api/health` returns `{ ok: true, db: true }` when the database responds; `503` with `{ ok: false, db: false }` if the DB check fails.

Use this for load balancers and uptime monitoring.

## Performance / tech debt (optional follow-ups)

- Large JS bundle: consider Vite `manualChunks` and route lazy loading.
- `database.js` imported only after config loads; avoid importing DB from modules that load before `config/index.js`.
