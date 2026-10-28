-- Existing claims remain delivered: upgrades must never replay old notifications.
ALTER TABLE public.reminder_delivery_claims
 ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent' CHECK(status IN ('pending','sent','failed')),
 ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
 ADD COLUMN IF NOT EXISTS expires_at timestamptz,
 ADD COLUMN IF NOT EXISTS lease_token uuid,
 ADD COLUMN IF NOT EXISTS lease_until timestamptz,
 ADD COLUMN IF NOT EXISTS last_status integer,
 ADD COLUMN IF NOT EXISTS sent_at timestamptz;
CREATE INDEX IF NOT EXISTS rooted_pending_deliveries ON public.reminder_delivery_claims(next_attempt_at)
WHERE status='pending';

CREATE OR REPLACE FUNCTION public.claim_rooted_reminders_v3()
RETURNS TABLE(device_id uuid,reminder_id uuid,user_id uuid,endpoint text,p256dh text,auth text,
 title text,message text,local_date date,lease_token uuid,attempt integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.reminder_delivery_claims(reminder_id,device_id,local_date,status,next_attempt_at,expires_at)
 SELECT r.id,d.id,(now() AT TIME ZONE COALESCE(pz.name,rz.name,'America/Chicago'))::date,'pending',now(),now()+interval '15 minutes'
 FROM public.daily_reminders r JOIN public.push_devices d ON d.user_id=r.user_id
 LEFT JOIN public.profiles p ON p.id=r.user_id
 LEFT JOIN pg_timezone_names pz ON pz.name=p.timezone
 LEFT JOIN pg_timezone_names rz ON rz.name=r.timezone
 WHERE r.enabled AND to_char(now() AT TIME ZONE COALESCE(pz.name,rz.name,'America/Chicago'),'HH24:MI')=r.delivery_time
 AND (NOT r.legacy_source OR d.last_sent_date IS DISTINCT FROM (now() AT TIME ZONE COALESCE(pz.name,rz.name,'America/Chicago'))::date)
 ON CONFLICT DO NOTHING;

 RETURN QUERY WITH ready AS (
  SELECT c.reminder_id,c.device_id,c.local_date FROM public.reminder_delivery_claims c
  JOIN public.daily_reminders r ON r.id=c.reminder_id
  JOIN public.push_devices d ON d.id=c.device_id AND d.user_id=r.user_id
  WHERE c.status='pending' AND c.next_attempt_at<=now() AND c.expires_at>now() AND c.attempts<4
  AND (c.lease_until IS NULL OR c.lease_until<=now()) AND r.enabled AND r.updated_at<=c.created_at
  ORDER BY c.next_attempt_at,c.reminder_id,c.device_id LIMIT 20 FOR UPDATE OF c SKIP LOCKED
 ), leased AS (
  UPDATE public.reminder_delivery_claims c SET attempts=c.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes'
  FROM ready q WHERE c.reminder_id=q.reminder_id AND c.device_id=q.device_id AND c.local_date=q.local_date
  RETURNING c.*
 )
 SELECT d.id,r.id,r.user_id,d.endpoint,d.p256dh,d.auth,r.title,r.message,c.local_date,c.lease_token,c.attempts
 FROM leased c JOIN public.daily_reminders r ON r.id=c.reminder_id JOIN public.push_devices d ON d.id=c.device_id;
END $$;
REVOKE ALL ON FUNCTION public.claim_rooted_reminders_v3() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_rooted_reminders_v3() TO service_role;

CREATE OR REPLACE FUNCTION public.finish_rooted_delivery(p_reminder_id uuid,p_device_id uuid,p_local_date date,
 p_lease_token uuid,p_ok boolean,p_retryable boolean,p_status integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changed integer;
BEGIN
 UPDATE public.reminder_delivery_claims c SET
  status=CASE WHEN p_ok THEN 'sent' WHEN p_retryable AND c.attempts<4 AND c.expires_at>now() THEN 'pending' ELSE 'failed' END,
  sent_at=CASE WHEN p_ok THEN now() ELSE NULL END,
  next_attempt_at=CASE WHEN NOT p_ok AND p_retryable THEN now()+make_interval(secs => (60*power(2,c.attempts-1))::integer) ELSE NULL END,
  last_status=p_status,lease_token=NULL,lease_until=NULL
 WHERE c.reminder_id=p_reminder_id AND c.device_id=p_device_id AND c.local_date=p_local_date AND c.lease_token=p_lease_token;
 GET DIAGNOSTICS changed=ROW_COUNT;
 RETURN changed=1;
END $$;
REVOKE ALL ON FUNCTION public.finish_rooted_delivery(uuid,uuid,date,uuid,boolean,boolean,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_rooted_delivery(uuid,uuid,date,uuid,boolean,boolean,integer) TO service_role;
