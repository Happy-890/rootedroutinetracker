-- Only the server can restore signed historical records. Normal scoring rules stay unchanged.
CREATE OR REPLACE FUNCTION public.guard_rooted_activity_date() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Activity records cannot be edited'; END IF;
 IF TG_OP='DELETE' THEN
  IF OLD.local_date<>public.rooted_scoring_date() THEN RAISE EXCEPTION 'This scoring day is closed. No catch-up after midnight Central time.'; END IF;
  RETURN OLD;
 END IF;
 IF NOT COALESCE((auth.role()='service_role' AND current_setting('rooted.verified_restore',true)='on'),false) AND NEW.local_date<>public.rooted_scoring_date() THEN
  RAISE EXCEPTION 'Points can only be earned today. No catch-up after midnight Central time.';
 END IF;
 IF NEW.local_date>public.rooted_scoring_date() OR NEW.activity NOT IN ('bible','prayer','marriage','relationship','exercise','nutrition','learn','plan','gratitude','journal') THEN RAISE EXCEPTION 'Invalid activity'; END IF;
 NEW.created_at:=clock_timestamp(); RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.guard_rooted_entry_date() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.local_date>public.rooted_scoring_date() OR (NOT NEW.archived_import AND NEW.local_date<>public.rooted_scoring_date()) THEN RAISE EXCEPTION 'This scoring day is closed. No catch-up after midnight Central time.'; END IF;
 IF NOT COALESCE((auth.role()='service_role' AND current_setting('rooted.verified_restore',true)='on'),false) THEN
  NEW.created_at:=clock_timestamp(); NEW.updated_at:=NEW.created_at;
 END IF;
 RETURN NEW;
END $$;
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
  INSERT INTO public.daily_reminders(id,user_id,title,message,delivery_time,timezone,enabled)
  VALUES((item->>'id')::uuid,p_user_id,item->>'title',item->>'message',item->>'delivery_time',p_backup->'profile'->>'timezone',(item->>'enabled')::boolean) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS changed=ROW_COUNT; restored_reminders:=restored_reminders+changed;
 END LOOP;
 PERFORM set_config('rooted.verified_restore','off',true);
 RETURN jsonb_build_object('records',restored_records,'entries',restored_entries,'reminders',restored_reminders);
END $$;
REVOKE ALL ON FUNCTION public.restore_rooted_backup(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.restore_rooted_backup(uuid,jsonb) TO service_role;

-- Read every account table in one snapshot, under the caller's ownership policies.
CREATE OR REPLACE FUNCTION public.export_rooted_backup_data() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT jsonb_build_object(
 'profile',(SELECT jsonb_build_object('display_name',p.display_name,'timezone',p.timezone) FROM public.profiles p WHERE p.id=auth.uid()),
 'records',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT local_date,activity FROM public.activity_records WHERE user_id=auth.uid() ORDER BY local_date,activity) x),'[]'::jsonb),
 'entries',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,kind,subtype,content,local_date,created_at,updated_at FROM public.entries WHERE user_id=auth.uid() ORDER BY id) x),'[]'::jsonb),
 'reminders',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,title,message,delivery_time,timezone,enabled FROM public.daily_reminders WHERE user_id=auth.uid() ORDER BY id) x),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.export_rooted_backup_data() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.export_rooted_backup_data() TO authenticated;
