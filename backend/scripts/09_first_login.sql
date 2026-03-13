-- Add first_login to users for first-time onboarding flow.
-- first_login = true → show onboarding; false → go to dashboard.
-- Default false so existing users skip onboarding.
-- Run once: psql $DATABASE_URL -f backend/scripts/09_first_login.sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS first_login BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.first_login IS 'true = show onboarding screens; false = go direct to dashboard';
