-- Reject invalid profile zones at the database boundary, including direct API writes.
UPDATE public.profiles p SET timezone='America/Chicago'
WHERE NOT EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name=p.timezone);
CREATE OR REPLACE FUNCTION public.validate_rooted_profile_timezone() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF length(NEW.timezone)>100 OR NOT EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name=NEW.timezone) THEN
  RAISE EXCEPTION 'Invalid profile timezone';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_rooted_profile_timezone ON public.profiles;
CREATE TRIGGER validate_rooted_profile_timezone BEFORE INSERT OR UPDATE OF timezone ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_rooted_profile_timezone();
REVOKE ALL ON FUNCTION public.validate_rooted_profile_timezone() FROM PUBLIC,anon,authenticated;

REVOKE ALL ON public.profiles,public.activity_records,public.entries,public.daily_reminders,
 public.reminder_preferences,public.push_devices,public.push_signing_config,
 public.reminder_delivery_claims,public.app_event_logs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.profiles TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.activity_records TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.entries,public.daily_reminders,public.reminder_preferences TO authenticated;
GRANT SELECT,DELETE ON public.push_devices TO authenticated;
GRANT INSERT(user_id,endpoint,p256dh,auth),UPDATE(user_id,endpoint,p256dh,auth) ON public.push_devices TO authenticated;
GRANT SELECT ON public.app_event_logs TO authenticated;

-- Backward-compatible scheduler also tolerates invalid legacy zones.
CREATE OR REPLACE FUNCTION public.claim_rooted_reminders_v2()
RETURNS TABLE(device_id uuid,reminder_id uuid,user_id uuid,endpoint text,p256dh text,auth text,title text,message text)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH due AS (
 SELECT d.id AS device_id,r.id AS reminder_id,(now() AT TIME ZONE COALESCE(pz.name,rz.name,'America/Chicago'))::date AS local_date
 FROM public.daily_reminders r JOIN public.push_devices d ON d.user_id=r.user_id
 LEFT JOIN public.profiles p ON p.id=r.user_id
 LEFT JOIN pg_timezone_names pz ON pz.name=p.timezone
 LEFT JOIN pg_timezone_names rz ON rz.name=r.timezone
 WHERE r.enabled AND to_char(now() AT TIME ZONE COALESCE(pz.name,rz.name,'America/Chicago'),'HH24:MI')=r.delivery_time
 AND (NOT r.legacy_source OR d.last_sent_date IS DISTINCT FROM (now() AT TIME ZONE COALESCE(pz.name,rz.name,'America/Chicago'))::date)
 ), claimed AS (
 INSERT INTO public.reminder_delivery_claims(reminder_id,device_id,local_date)
 SELECT reminder_id,device_id,local_date FROM due ON CONFLICT DO NOTHING RETURNING reminder_id,device_id
 )
 SELECT d.id,r.id,r.user_id,d.endpoint,d.p256dh,d.auth,r.title,r.message FROM claimed c
 JOIN public.daily_reminders r ON r.id=c.reminder_id JOIN public.push_devices d ON d.id=c.device_id;
$$;
REVOKE ALL ON FUNCTION public.claim_rooted_reminders_v2() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_rooted_reminders_v2() TO service_role;
