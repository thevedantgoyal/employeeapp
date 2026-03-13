-- Request System: requests + request_trail
-- Hierarchy uses profiles.manager_id (profile id); we store user_id (users.id) in requests.

BEGIN;

CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  request_type TEXT NOT NULL CHECK (request_type IN ('resource', 'task_deadline', 'task_reassignment', 'general')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'forwarded', 'approved', 'rejected', 'cancelled')),
  submitted_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  submitted_to UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  current_handler UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  forwarded_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  forwarded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  forward_note TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actioned_at TIMESTAMPTZ
);

CREATE INDEX idx_requests_submitted_by ON public.requests(submitted_by);
CREATE INDEX idx_requests_submitted_to ON public.requests(submitted_to);
CREATE INDEX idx_requests_current_handler ON public.requests(current_handler);
CREATE INDEX idx_requests_status ON public.requests(status);
CREATE INDEX idx_requests_created_at ON public.requests(created_at DESC);

CREATE TABLE public.request_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('submitted', 'forwarded', 'approved', 'rejected', 'cancelled', 'edited')),
  action_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action_by_name TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_request_trail_request_id ON public.request_trail(request_id);

COMMIT;
