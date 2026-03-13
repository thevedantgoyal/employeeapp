-- Seed 7 default rooms (Room1 .. Room7). Idempotent: inserts only when each name is missing.
-- App uses table meeting_rooms (GET /api/data/meeting_rooms). status = 'active' means room is active.
-- Usage: psql $DATABASE_URL -f backend/scripts/02_seed_meeting_rooms.sql
-- To verify first: SELECT * FROM meeting_rooms;

INSERT INTO public.meeting_rooms (name, location, floor, capacity, has_projector, has_video_conferencing, has_whiteboard, status, created_by)
SELECT v.name, v.location, v.floor, v.capacity, v.has_projector, v.has_video_conferencing, v.has_whiteboard, v.status, u.id
FROM (VALUES
  ('Room1', 'Building A', '1', 10, true, true, true, 'active'),
  ('Room2', 'Building A', '1', 10, true, true, true, 'active'),
  ('Room3', 'Building A', '1', 10, true, true, true, 'active'),
  ('Room4', 'Building A', '1', 10, true, true, true, 'active'),
  ('Room5', 'Building A', '1', 10, true, true, true, 'active'),
  ('Room6', 'Building A', '1', 10, true, true, true, 'active'),
  ('Room7', 'Building A', '1', 10, true, true, true, 'active')
) AS v(name, location, floor, capacity, has_projector, has_video_conferencing, has_whiteboard, status)
CROSS JOIN (SELECT id FROM public.users LIMIT 1) u
WHERE NOT EXISTS (SELECT 1 FROM public.meeting_rooms m WHERE m.name = v.name);
