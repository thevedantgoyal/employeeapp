/**
 * PM2 ecosystem — run from the backend directory so `cwd` matches this file.
 *
 * Start:   cd backend && pm2 start ecosystem.config.cjs
 * Reload:  pm2 restart employeeapp --update-env
 *
 * Secrets: Put DATABASE_URL, JWT_SECRET, CORS_ORIGIN in backend/.env (loaded by
 * src/config/index.js) or inject via host / PM2 env. This app exits on boot if
 * DATABASE_URL is missing.
 */
module.exports = {
  apps: [
    {
      name: 'employeeapp',
      cwd: __dirname,
      script: 'src/index.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
  ],
};
