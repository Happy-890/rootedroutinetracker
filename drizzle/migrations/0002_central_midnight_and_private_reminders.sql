CREATE OR REPLACE FUNCTION public.rooted_scoring_date() RETURNS date LANGUAGE sql VOLATILE SET search_path = public AS $$ SELECT (clock_timestamp() AT TIME ZONE 'America/Chicago')::date $$;
CREATE OR REPLACE FUNCTION public.guard_rooted_activity_date() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Activity records cannot be edited'; END IF;
 IF TG_OP = 'DELETE' THEN
  IF OLD.local_date <> public.rooted_scoring_date() THEN RAISE EXCEPTION 'This scoring day is closed. No catch-up after midnight Central time.'; END IF;
  RETURN OLD;
 END IF;
 IF NEW.local_date <> public.rooted_scoring_date() THEN RAISE EXCEPTION 'Points can only be earned today. No catch-up after midnight Central time.'; END IF;
 IF NEW.activity NOT IN ('bible','prayer','marriage','relationship','exercise','nutrition','learn','plan','gratitude','journal') THEN RAISE EXCEPTION 'Unknown activity'; END IF;
 NEW.created_at := clock_timestamp(); RETURN NEW;
END $$;
CREATE TRIGGER rooted_activity_date_guard BEFORE INSERT OR UPDATE OR DELETE ON public.activity_records FOR EACH ROW EXECUTE FUNCTION public.guard_rooted_activity_date();
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS archived_import boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.entries.archived_import IS 'Historical guest imports retained as writing only; never award account points.';
CREATE OR REPLACE FUNCTION public.guard_rooted_entry_date() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.local_date > public.rooted_scoring_date() OR (NOT NEW.archived_import AND NEW.local_date <> public.rooted_scoring_date()) THEN RAISE EXCEPTION 'This scoring day is closed. No catch-up after midnight Central time.'; END IF;
 NEW.created_at := clock_timestamp(); NEW.updated_at := NEW.created_at; RETURN NEW;
END $$;
CREATE TRIGGER rooted_entry_date_guard BEFORE INSERT ON public.entries FOR EACH ROW EXECUTE FUNCTION public.guard_rooted_entry_date();
CREATE OR REPLACE FUNCTION public.entries_guard_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.local_date := OLD.local_date; NEW.user_id := OLD.user_id; NEW.kind := OLD.kind; NEW.created_at := OLD.created_at; NEW.archived_import := OLD.archived_import; NEW.updated_at := now(); RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.award_entry_activity() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN IF NOT NEW.archived_import THEN INSERT INTO public.activity_records (user_id, local_date, activity) VALUES (NEW.user_id, NEW.local_date, NEW.kind) ON CONFLICT (user_id, local_date, activity) DO NOTHING; END IF; RETURN NEW; END $$;
CREATE TABLE public.reminder_preferences (
 user_id uuid PRIMARY KEY,
 enabled boolean NOT NULL DEFAULT false,
 delivery_time text NOT NULL DEFAULT '20:00',
 timezone text NOT NULL DEFAULT 'America/Chicago',
 message text NOT NULL DEFAULT 'Build what matters, daily.',
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_preferences TO authenticated;
GRANT ALL ON public.reminder_preferences TO service_role;
ALTER TABLE public.reminder_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_reminders ON public.reminder_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TABLE public.push_devices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 endpoint text NOT NULL UNIQUE,
 p256dh text NOT NULL,
 auth text NOT NULL,
 last_sent_date date,
 last_test_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_devices TO authenticated;
GRANT ALL ON public.push_devices TO service_role;
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_push_devices ON public.push_devices FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX push_devices_user ON public.push_devices(user_id);
CREATE OR REPLACE FUNCTION public.validate_rooted_reminder() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.delivery_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'Invalid reminder time'; END IF;
 IF length(btrim(NEW.message)) < 1 OR length(NEW.message) > 200 THEN RAISE EXCEPTION 'Reminder message must be 1 to 200 characters'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
 NEW.updated_at := now(); RETURN NEW;
END $$;
CREATE TRIGGER rooted_reminder_validation BEFORE INSERT OR UPDATE ON public.reminder_preferences FOR EACH ROW EXECUTE FUNCTION public.validate_rooted_reminder();
CREATE OR REPLACE FUNCTION public.claim_rooted_reminders() RETURNS TABLE (device_id uuid, endpoint text, p256dh text, auth text, message text) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 WITH due AS (
 SELECT d.id, p.message, (now() AT TIME ZONE p.timezone)::date AS today
 FROM public.push_devices d JOIN public.reminder_preferences p ON p.user_id = d.user_id
 WHERE p.enabled AND to_char(now() AT TIME ZONE p.timezone, 'HH24:MI') = p.delivery_time
 AND d.last_sent_date IS DISTINCT FROM (now() AT TIME ZONE p.timezone)::date
 FOR UPDATE OF d SKIP LOCKED
 ), claimed AS (
 UPDATE public.push_devices d SET last_sent_date = due.today FROM due WHERE d.id = due.id
 RETURNING d.id, d.endpoint, d.p256dh, d.auth, due.message
 ) SELECT * FROM claimed;
$$;
REVOKE ALL ON FUNCTION public.claim_rooted_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_rooted_reminders() TO service_role;