CREATE TABLE public.app_event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event text NOT NULL,
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info','warning','error')),
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_event_logs_user_created ON public.app_event_logs (user_id, created_at DESC);
GRANT SELECT ON public.app_event_logs TO authenticated;
GRANT ALL ON public.app_event_logs TO service_role;
ALTER TABLE public.app_event_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own logs" ON public.app_event_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);