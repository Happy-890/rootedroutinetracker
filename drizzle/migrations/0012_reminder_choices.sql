ALTER TABLE public.daily_reminders
 ADD COLUMN IF NOT EXISTS destination text NOT NULL DEFAULT '/' CHECK(destination IN ('/','/journal','/gratitude','/finance?tab=learn','/finance?tab=plan','/history?view=review')),
 ADD COLUMN IF NOT EXISTS repeat_mode text NOT NULL DEFAULT 'daily' CHECK(repeat_mode IN ('daily','interval','weekdays')),
 ADD COLUMN IF NOT EXISTS weekdays integer NOT NULL DEFAULT 127 CHECK(weekdays BETWEEN 1 AND 127),
 ADD COLUMN IF NOT EXISTS every_days integer NOT NULL DEFAULT 2 CHECK(every_days BETWEEN 2 AND 365),
 ADD COLUMN IF NOT EXISTS start_date date;
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
 WHERE (r.repeat_mode='daily' OR (r.repeat_mode='weekdays' AND (r.weekdays & (1 << extract(dow FROM (now() AT TIME ZONE COALESCE(pz.name,rz.name,'America/Chicago'))::date)::int))<>0) OR (r.repeat_mode='interval' AND (now() AT TIME ZONE COALESCE(pz.name,rz.name,'America/Chicago'))::date>=r.start_date AND ((now() AT TIME ZONE COALESCE(pz.name,rz.name,'America/Chicago'))::date-r.start_date)%r.every_days=0)) AND r.enabled AND to_char(now() AT TIME ZONE COALESCE(pz.name,rz.name,'America/Chicago'),'HH24:MI')=r.delivery_time
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

CREATE OR REPLACE FUNCTION public.claim_rooted_reminders_v4()
RETURNS TABLE(device_id uuid,reminder_id uuid,user_id uuid,endpoint text,p256dh text,auth text,
 title text,message text,local_date date,lease_token uuid,attempt integer,destination text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.reminder_delivery_claims(reminder_id,device_id,local_date,status,next_attempt_at,expires_at)
 SELECT r.id,d.id,(now() AT TIME ZONE COALESCE(pz.name,rz.name,'America/Chicago'))::date,'pending',now(),now()+interval '15 minutes'
 FROM public.daily_reminders r JOIN public.push_devices d ON d.user_id=r.user_id
 LEFT JOIN public.profiles p ON p.id=r.user_id
 LEFT JOIN pg_timezone_names pz ON pz.name=p.timezone
 LEFT JOIN pg_timezone_names rz ON rz.name=r.timezone
 WHERE (r.repeat_mode='daily' OR (r.repeat_mode='weekdays' AND (r.weekdays & (1 << extract(dow FROM (now() AT TIME ZONE COALESCE(pz.name,rz.name,'America/Chicago'))::date)::int))<>0) OR (r.repeat_mode='interval' AND (now() AT TIME ZONE COALESCE(pz.name,rz.name,'America/Chicago'))::date>=r.start_date AND ((now() AT TIME ZONE COALESCE(pz.name,rz.name,'America/Chicago'))::date-r.start_date)%r.every_days=0)) AND r.enabled AND to_char(now() AT TIME ZONE COALESCE(pz.name,rz.name,'America/Chicago'),'HH24:MI')=r.delivery_time
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
 SELECT d.id,r.id,r.user_id,d.endpoint,d.p256dh,d.auth,r.title,r.message,c.local_date,c.lease_token,c.attempts,r.destination
 FROM leased c JOIN public.daily_reminders r ON r.id=c.reminder_id JOIN public.push_devices d ON d.id=c.device_id;
END $$;
REVOKE ALL ON FUNCTION public.claim_rooted_reminders_v4() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_rooted_reminders_v4() TO service_role;

CREATE OR REPLACE FUNCTION public.export_rooted_backup_data() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT jsonb_build_object(
 'profile',(SELECT jsonb_build_object('display_name',p.display_name,'timezone',p.timezone) FROM public.profiles p WHERE p.id=auth.uid()),
 'records',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT local_date,activity FROM public.activity_records WHERE user_id=auth.uid() ORDER BY local_date,activity) x),'[]'::jsonb),
 'entries',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,kind,subtype,content,local_date,created_at,updated_at FROM public.entries WHERE user_id=auth.uid() ORDER BY id) x),'[]'::jsonb),
 'reminders',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,title,message,delivery_time,timezone,enabled,destination,repeat_mode,weekdays,every_days,start_date FROM public.daily_reminders WHERE user_id=auth.uid() ORDER BY id) x),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.export_rooted_backup_data() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.export_rooted_backup_data() TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_rooted_backup(p_user_id uuid,p_backup jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE item jsonb; restored_records integer:=0; restored_entries integer:=0; restored_reminders integer:=0; changed integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server-only operation'; END IF;
 IF p_backup->>'owner_id' IS DISTINCT FROM p_user_id::text OR p_backup->>'format' IS DISTINCT FROM 'rooted-backup' OR p_backup->>'version' IS DISTINCT FROM '2' THEN RAISE EXCEPTION 'Invalid backup'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id) THEN RAISE EXCEPTION 'Account not found'; END IF;
 PERFORM set_config('rooted.verified_restore','on',true);
 UPDATE public.profiles SET display_name=p_backup->'profile'->>'display_name',timezone=p_backup->'profile'->>'timezone' WHERE id=p_user_id;
 FOR item IN SELECT * FROM jsonb_array_elements(p_backup->'records') LOOP
  INSERT INTO public.activity_records(user_id,local_date,activity) VALUES(p_user_id,(item->>'local_date')::date,item->>'activity') ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS changed=ROW_COUNT; restored_records:=restored_records+changed;
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(p_backup->'entries') LOOP
  IF EXISTS(SELECT 1 FROM public.entries WHERE id=(item->>'id')::uuid AND user_id<>p_user_id) THEN RAISE EXCEPTION 'Entry conflict'; END IF;
  -- Restore writing without minting additional points; signed activity records above restore the original score.
  INSERT INTO public.entries(id,user_id,kind,subtype,content,local_date,created_at,updated_at,archived_import)
  VALUES((item->>'id')::uuid,p_user_id,item->>'kind',item->>'subtype',item->'content',(item->>'local_date')::date,(item->>'created_at')::timestamptz,(item->>'updated_at')::timestamptz,true) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS changed=ROW_COUNT; restored_entries:=restored_entries+changed;
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(p_backup->'reminders') LOOP
  IF EXISTS(SELECT 1 FROM public.daily_reminders WHERE id=(item->>'id')::uuid AND user_id<>p_user_id) THEN RAISE EXCEPTION 'Reminder conflict'; END IF;
  INSERT INTO public.daily_reminders(id,user_id,title,message,delivery_time,timezone,enabled,destination,repeat_mode,weekdays,every_days,start_date)
  VALUES((item->>'id')::uuid,p_user_id,item->>'title',item->>'message',item->>'delivery_time',p_backup->'profile'->>'timezone',(item->>'enabled')::boolean,coalesce(item->>'destination','/'),coalesce(item->>'repeat_mode','daily'),coalesce((item->>'weekdays')::int,127),coalesce((item->>'every_days')::int,2),(item->>'start_date')::date) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS changed=ROW_COUNT; restored_reminders:=restored_reminders+changed;
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_backup->'growth','[]'::jsonb)) LOOP
  INSERT INTO public.growth_records(user_id,kind,key,value) VALUES(p_user_id,item->>'kind',item->>'key',item->'value') ON CONFLICT DO NOTHING;
 END LOOP;
 PERFORM set_config('rooted.verified_restore','off',true);
 RETURN jsonb_build_object('records',restored_records,'entries',restored_entries,'reminders',restored_reminders);
END $$;
REVOKE ALL ON FUNCTION public.restore_rooted_backup(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.restore_rooted_backup(uuid,jsonb) TO service_role;
