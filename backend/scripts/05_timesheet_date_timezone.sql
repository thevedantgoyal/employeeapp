-- -----------------------------------------------------------------------------
-- Timesheet date column: ensure DATE type (calendar date only, no timezone)
-- Run after 04_timesheet_work_type.sql.
-- Prevents timezone shift bugs: store only YYYY-MM-DD; never TIMESTAMP/UTC.
-- -----------------------------------------------------------------------------

-- Ensure column is DATE (no-op if already DATE)
ALTER TABLE public.timesheets
  ALTER COLUMN date TYPE DATE USING date::date;

COMMENT ON COLUMN public.timesheets.date IS 'Calendar date only (YYYY-MM-DD). Sent from client in local date; do not use toISOString() or UTC.';

-- -----------------------------------------------------------------------------
-- Fix existing rows stored as previous day (UTC shift when user logged "today")
-- e.g. user in IST selected 2026-03-04 → backend stored 2026-03-03.
-- Set date to the calendar date of created_at in IST (UTC+5:30) where stored
-- date is before that (catches one-day-behind and similar).
-- For other timezones, change the interval (e.g. '-5 hours' for EST).
-- -----------------------------------------------------------------------------
UPDATE public.timesheets t
SET date = ((t.created_at AT TIME ZONE 'UTC' + interval '5 hours 30 minutes')::timestamp)::date
WHERE t.date < ((t.created_at AT TIME ZONE 'UTC' + interval '5 hours 30 minutes')::timestamp)::date;
