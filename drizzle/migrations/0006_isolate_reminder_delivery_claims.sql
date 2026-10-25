REVOKE ALL ON public.reminder_delivery_claims FROM anon,authenticated;
REVOKE ALL ON public.daily_reminders FROM anon;
CREATE OR REPLACE FUNCTION public.claim_rooted_reminders_v2()
RETURNS TABLE(device_id uuid,reminder_id uuid,user_id uuid,endpoint text,p256dh text,auth text,title text,message text)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH due AS (
 SELECT d.id AS device_id,r.id AS reminder_id,(now() AT TIME ZONE r.timezone)::date AS local_date
 FROM public.daily_reminders r JOIN public.push_devices d ON d.user_id=r.user_id
 WHERE r.enabled AND to_char(now() AT TIME ZONE r.timezone,'HH24:MI')=r.delivery_time
 AND (NOT r.legacy_source OR d.last_sent_date IS DISTINCT FROM (now() AT TIME ZONE r.timezone)::date)
 ), claimed AS (
 INSERT INTO public.reminder_delivery_claims(reminder_id,device_id,local_date)
 SELECT reminder_id,device_id,local_date FROM due ON CONFLICT DO NOTHING RETURNING reminder_id,device_id
 )
 SELECT d.id,r.id,r.user_id,d.endpoint,d.p256dh,d.auth,r.title,r.message FROM claimed c
 JOIN public.daily_reminders r ON r.id=c.reminder_id JOIN public.push_devices d ON d.id=c.device_id;
$$;
REVOKE ALL ON FUNCTION public.claim_rooted_reminders_v2() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_rooted_reminders_v2() TO service_role;