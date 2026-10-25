CREATE TABLE public.daily_reminders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 title text NOT NULL DEFAULT 'Daily Check-In', message text NOT NULL DEFAULT 'Build what matters, daily.',
 delivery_time text NOT NULL DEFAULT '20:00', timezone text NOT NULL DEFAULT 'America/Chicago',
 enabled boolean NOT NULL DEFAULT true, legacy_source boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT reminder_title_valid CHECK (length(btrim(title)) BETWEEN 1 AND 80),
 CONSTRAINT reminder_message_valid CHECK (length(btrim(message)) BETWEEN 1 AND 200),
 CONSTRAINT reminder_time_valid CHECK (delivery_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.daily_reminders TO authenticated;
GRANT ALL ON public.daily_reminders TO service_role;
ALTER TABLE public.daily_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_daily_reminders ON public.daily_reminders TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX daily_reminders_owner ON public.daily_reminders(user_id, created_at);
CREATE UNIQUE INDEX daily_reminders_legacy ON public.daily_reminders(user_id) WHERE legacy_source;
CREATE TRIGGER validate_daily_reminders BEFORE INSERT OR UPDATE ON public.daily_reminders FOR EACH ROW EXECUTE FUNCTION public.validate_rooted_reminder();
CREATE TABLE public.reminder_delivery_claims (
 reminder_id uuid NOT NULL REFERENCES public.daily_reminders(id) ON DELETE CASCADE,
 device_id uuid NOT NULL REFERENCES public.push_devices(id) ON DELETE CASCADE,
 local_date date NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(reminder_id,device_id,local_date)
);
GRANT ALL ON public.reminder_delivery_claims TO service_role;
ALTER TABLE public.reminder_delivery_claims ENABLE ROW LEVEL SECURITY;
INSERT INTO public.daily_reminders(user_id,enabled,delivery_time,timezone,message,legacy_source)
 SELECT user_id,enabled,delivery_time,timezone,message,true FROM public.reminder_preferences;
INSERT INTO public.reminder_delivery_claims(reminder_id,device_id,local_date)
 SELECT r.id,d.id,d.last_sent_date FROM public.daily_reminders r JOIN public.push_devices d ON d.user_id=r.user_id WHERE d.last_sent_date IS NOT NULL;
CREATE OR REPLACE FUNCTION public.sync_legacy_rooted_reminder() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.daily_reminders(user_id,enabled,delivery_time,timezone,message,legacy_source)
 VALUES(NEW.user_id,NEW.enabled,NEW.delivery_time,NEW.timezone,NEW.message,true)
 ON CONFLICT(user_id) WHERE legacy_source DO UPDATE SET enabled=EXCLUDED.enabled,delivery_time=EXCLUDED.delivery_time,timezone=EXCLUDED.timezone,message=EXCLUDED.message;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_legacy_rooted_reminder AFTER INSERT OR UPDATE ON public.reminder_preferences FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_rooted_reminder();
REVOKE ALL ON FUNCTION public.sync_legacy_rooted_reminder() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.claim_rooted_reminders_v2()
RETURNS TABLE(device_id uuid,reminder_id uuid,user_id uuid,endpoint text,p256dh text,auth text,title text,message text)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH due AS (
 SELECT d.id AS device_id,r.id AS reminder_id,(now() AT TIME ZONE r.timezone)::date AS local_date
 FROM public.daily_reminders r JOIN public.push_devices d ON d.user_id=r.user_id
 WHERE r.enabled AND to_char(now() AT TIME ZONE r.timezone,'HH24:MI')=r.delivery_time
 ), claimed AS (
 INSERT INTO public.reminder_delivery_claims(reminder_id,device_id,local_date)
 SELECT reminder_id,device_id,local_date FROM due ON CONFLICT DO NOTHING RETURNING reminder_id,device_id
 )
 SELECT d.id,r.id,r.user_id,d.endpoint,d.p256dh,d.auth,r.title,r.message FROM claimed c
 JOIN public.daily_reminders r ON r.id=c.reminder_id JOIN public.push_devices d ON d.id=c.device_id;
$$;
REVOKE ALL ON FUNCTION public.claim_rooted_reminders_v2() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_rooted_reminders_v2() TO service_role;