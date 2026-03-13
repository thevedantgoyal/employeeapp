-- Track which audit (participant) bookings the user has viewed, for notification badge.
CREATE TABLE IF NOT EXISTS public.audit_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.room_bookings(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, booking_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_views_user_id ON public.audit_views(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_views_booking_id ON public.audit_views(booking_id);
