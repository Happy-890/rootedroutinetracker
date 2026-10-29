-- Unscored reflection/planning data. No activity or entry triggers are involved.
CREATE OR REPLACE FUNCTION public.valid_rooted_growth(p_kind text,p_key text,p_value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE item jsonb; k text; v jsonb; d date;
BEGIN
 IF octet_length(p_value::text)>20000 THEN RETURN false; END IF;
 IF p_kind IN ('review','priorities') THEN
  d:=p_key::date;
  IF to_char(d,'YYYY-MM-DD')<>p_key THEN RETURN false; END IF;
 END IF;
 IF p_kind='review' THEN
  IF extract(isodow FROM d)<>1 OR jsonb_typeof(p_value)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(p_value))<>4 THEN RETURN false; END IF;
  FOREACH k IN ARRAY ARRAY['worked','obstacle','change','commitment'] LOOP
   IF jsonb_typeof(p_value->k) IS DISTINCT FROM 'string' OR length(p_value->>k)>(CASE WHEN k='commitment' THEN 500 ELSE 2000 END) THEN RETURN false; END IF;
  END LOOP;
 ELSIF p_kind='priorities' THEN
  IF jsonb_typeof(p_value)<>'array' OR jsonb_array_length(p_value)>3 THEN RETURN false; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p_value) LOOP
   IF jsonb_typeof(item)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(item))<>4
    OR jsonb_typeof(item->'title') IS DISTINCT FROM 'string' OR length(btrim(item->>'title')) NOT BETWEEN 1 AND 160
    OR jsonb_typeof(item->'when') IS DISTINCT FROM 'string' OR length(item->>'when')>200
    OR jsonb_typeof(item->'pillar') IS DISTINCT FROM 'string' OR item->>'pillar' NOT IN ('','faith','family','fitness','finance')
    OR jsonb_typeof(item->'done') IS DISTINCT FROM 'boolean' THEN RETURN false; END IF;
  END LOOP;
 ELSIF p_kind='definitions' THEN
  IF p_key<>'personal' OR jsonb_typeof(p_value)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(p_value))<>2
   OR jsonb_typeof(p_value->'why') IS DISTINCT FROM 'string' OR length(p_value->>'why')>1000
   OR jsonb_typeof(p_value->'habits') IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  FOR k,v IN SELECT * FROM jsonb_each(p_value->'habits') LOOP
   IF k NOT IN ('bible','prayer','marriage','relationship','exercise','nutrition','learn','plan') OR jsonb_typeof(v)<>'string' OR length(v#>>'{}')>200 THEN RETURN false; END IF;
  END LOOP;
 ELSE RETURN false;
 END IF;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
CREATE TABLE IF NOT EXISTS public.growth_records (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 kind text NOT NULL, key text NOT NULL, value jsonb NOT NULL,
 PRIMARY KEY(user_id,kind,key), CHECK(public.valid_rooted_growth(kind,key,value))
);
ALTER TABLE public.growth_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS growth_owner_read ON public.growth_records;
CREATE POLICY growth_owner_read ON public.growth_records FOR SELECT TO authenticated USING (user_id=auth.uid());
REVOKE ALL ON public.growth_records FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.growth_records TO authenticated;
GRANT ALL ON public.growth_records TO service_role;
CREATE OR REPLACE FUNCTION public.save_rooted_growth(p_kind text,p_key text,p_value jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE uid uuid:=auth.uid();
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 IF NOT public.valid_rooted_growth(p_kind,p_key,p_value) THEN RAISE EXCEPTION 'Invalid planning data'; END IF;
 IF p_kind='priorities' AND p_key<>public.rooted_scoring_date()::text THEN RAISE EXCEPTION 'Only today''s priorities can be changed'; END IF;
 IF p_kind='review' AND p_key::date>public.rooted_scoring_date() THEN RAISE EXCEPTION 'Future review not allowed'; END IF;
 INSERT INTO public.growth_records(user_id,kind,key,value) VALUES(uid,p_kind,p_key,p_value)
 ON CONFLICT(user_id,kind,key) DO UPDATE SET value=excluded.value;
END $$;
-- Merge device-only unscored history without overwriting existing account records.
CREATE OR REPLACE FUNCTION public.import_rooted_growth(p_records jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE uid uuid:=auth.uid(); item jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 IF jsonb_typeof(p_records)<>'array' OR jsonb_array_length(p_records)>50000 OR octet_length(p_records::text)>10000000 THEN RAISE EXCEPTION 'Invalid planning import'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_records) LOOP
  IF NOT public.valid_rooted_growth(item->>'kind',item->>'key',item->'value') THEN RAISE EXCEPTION 'Invalid planning data'; END IF;
  IF item->>'kind' IN ('review','priorities') AND (item->>'key')::date>public.rooted_scoring_date() THEN RAISE EXCEPTION 'Future planning import not allowed'; END IF;
  INSERT INTO public.growth_records(user_id,kind,key,value) VALUES(uid,item->>'kind',item->>'key',item->'value') ON CONFLICT DO NOTHING;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.save_rooted_growth(text,text,jsonb), public.import_rooted_growth(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_rooted_growth(text,text,jsonb), public.import_rooted_growth(jsonb) TO authenticated;
-- Separate RPC keeps older published clients compatible during rollout.
CREATE OR REPLACE FUNCTION public.export_rooted_growth_backup_data() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT public.export_rooted_backup_data() || jsonb_build_object('growth',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT kind,key,value FROM public.growth_records WHERE user_id=auth.uid() ORDER BY kind,key) x),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.export_rooted_growth_backup_data() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.export_rooted_growth_backup_data() TO authenticated;

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
 FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_backup->'growth','[]'::jsonb)) LOOP
  INSERT INTO public.growth_records(user_id,kind,key,value) VALUES(p_user_id,item->>'kind',item->>'key',item->'value') ON CONFLICT DO NOTHING;
 END LOOP;
 PERFORM set_config('rooted.verified_restore','off',true);
 RETURN jsonb_build_object('records',restored_records,'entries',restored_entries,'reminders',restored_reminders);
END $$;
REVOKE ALL ON FUNCTION public.restore_rooted_backup(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.restore_rooted_backup(uuid,jsonb) TO service_role;

