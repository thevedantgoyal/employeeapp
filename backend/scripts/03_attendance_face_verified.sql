-- Add face_verified to attendance (backend enforces verification before check-in)
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS face_verified BOOLEAN NOT NULL DEFAULT false;

