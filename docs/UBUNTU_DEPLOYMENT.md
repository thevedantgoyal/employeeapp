# Ubuntu Linux — full deployment (PostgreSQL, backend, frontend)

Step-by-step commands to deploy this application on a fresh **Ubuntu** server after the code is in GitHub. Replace placeholders (`your-domain.com`, `YOUR_REPO`, passwords, paths) with your values.

Related docs: [DEPLOYMENT.md](DEPLOYMENT.md) (troubleshooting), [deploy/nginx-api.example.conf](../deploy/nginx-api.example.conf) (nginx snippet).

---

## 1. Server packages and Node.js

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nginx curl build-essential
```

Install **Node.js 20 LTS**:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

Install **PM2** (process manager for the API):

```bash
sudo npm install -g pm2
```

Optional — PostgreSQL client tools (useful for `psql` checks):

```bash
sudo apt install -y postgresql-client
```

---

## 2. Clone the application

Pick an app root (example: `/var/www/employeeapp`):

```bash
sudo mkdir -p /var/www/employeeapp
sudo chown "$USER:$USER" /var/www/employeeapp
cd /var/www/employeeapp
git clone https://github.com/YOUR_ORG/YOUR_REPO.git .
```

If the repo is not at the root of the clone, `cd` into the project folder that contains `backend/` and `frontend/`.

---

## 3. Database (PostgreSQL)

### Option A — Database already exists (remote or managed)

Create a user/database on your provider, allow this server’s IP in firewall/security groups, then set `DATABASE_URL` in backend `.env` (section 4).

For PostgreSQL **without** TLS on the wire, the app expects either `?sslmode=disable` on the URL and/or `DATABASE_SSL=false` (see [DEPLOYMENT.md](DEPLOYMENT.md) §2).

Example URL shape:

```text
postgresql://DB_USER:DB_PASSWORD@DB_HOST:5432/DB_NAME?sslmode=disable
```

Skip to **section 4** if you are not installing Postgres on this VM.

### Option B — Install PostgreSQL on the same Ubuntu server

```bash
sudo apt install -y postgresql postgresql-contrib
```

Create role and database (edit password):

```bash
sudo -u postgres psql <<'SQL'
CREATE USER appuser WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';
CREATE DATABASE employeeapp OWNER appuser;
SQL
```

Connection string for `DATABASE_URL`:

```text
postgresql://appuser:REPLACE_WITH_STRONG_PASSWORD@127.0.0.1:5432/employeeapp
```

---

## 4. Backend (Node + PM2)

```bash
cd /var/www/employeeapp/backend
npm ci
```

Create `backend/.env` (use `nano`, `vim`, or copy from a secure template):

```bash
nano .env
```

**Minimum production example** (adjust every value):

```env
NODE_ENV=production
PORT=4000
API_PREFIX=/api

DATABASE_URL=postgresql://appuser:REPLACE_WITH_STRONG_PASSWORD@127.0.0.1:5432/employeeapp?sslmode=disable
DATABASE_SSL=false

JWT_SECRET=replace-with-long-random-secret-at-least-32-characters

CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com
```

Add any other variables your app needs (copy from local `.env`: Azure, VAPID, `FILE_BASE_URL`, etc.).

**First-time schema** (only on an **empty** database):

```bash
npm run migrate
```

Start the API with PM2 from the **backend** directory (`cwd` must be `backend` so `.env` and paths resolve correctly):

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u "$USER" --hp "$HOME"
```

The ecosystem file defines the process name **`employeeapp`**. After **any** change to `.env` on disk:

```bash
pm2 restart employeeapp --update-env
```

**Health check** (from the server):

```bash
curl -s http://127.0.0.1:4000/api/health
```

Expect JSON including `"ok":true` and `"db":true` when the database is reachable.

---

## 5. Frontend (Vite build + static files)

### Same origin (recommended): nginx serves the SPA and proxies `/api` to Node

Do **not** set `VITE_API_URL` so the production build uses same-origin `/api` (see `frontend/src/integrations/api/baseUrl.ts`).

```bash
cd /var/www/employeeapp/frontend
npm ci
npm run build
```

Built assets are under `frontend/dist/`.

Copy them to the directory nginx will use (example):

```bash
sudo mkdir -p /var/www/html/employeeapp
sudo rsync -av --delete dist/ /var/www/html/employeeapp/
sudo chown -R www-data:www-data /var/www/html/employeeapp
```

### Split domains (API on another host)

Set the API URL **before** building:

```bash
cd /var/www/employeeapp/frontend
export VITE_API_URL=https://api.your-domain.com/api
npm ci
npm run build
```

See also `frontend/.env.example`.

---

## 6. Nginx (reverse proxy + SPA)

Create a site config (replace `your-domain.com` and `root` path):

```bash
sudo nano /etc/nginx/sites-available/employeeapp
```

Example **HTTP** server block (SPA + `/api` → backend on port 4000):

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    root /var/www/html/employeeapp;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and test:

```bash
sudo ln -sf /etc/nginx/sites-available/employeeapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

HTTPS with Let’s Encrypt:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## 7. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 8. After you change frontend code

Rebuild and redeploy static files:

```bash
cd /var/www/employeeapp/frontend
git pull
npm ci
npm run build
sudo rsync -av --delete dist/ /var/www/html/employeeapp/
```

---

## 9. After you change backend code

```bash
cd /var/www/employeeapp/backend
git pull
npm ci
pm2 restart employeeapp --update-env
```

---

## 10. Quick verification checklist

| Step | Command or action |
|------|-------------------|
| API process | `pm2 status` — `employeeapp` online |
| Health | `curl -s https://your-domain.com/api/health` |
| Login | Browser: `POST /api/auth/login` works from your app |
| Secrets | Strong `JWT_SECRET`; production `NODE_ENV` |

---

## 11. Optional: seed / admin scripts

Run only if you intend to (development-style seeds are not always appropriate for production):

```bash
cd /var/www/employeeapp/backend
# Examples — see package.json and scripts/:
# npm run seed
```

Use `backend/scripts/set-admin-password.js` or similar for bcrypt-hashed passwords ([DEPLOYMENT.md](DEPLOYMENT.md) §8).
