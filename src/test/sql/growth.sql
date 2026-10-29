-- Run with 0011 inside a transaction and ROLLBACK. All fixtures are temporary.
CREATE TEMP TABLE growth_qa AS SELECT gen_random_uuid() AS a, gen_random_uuid() AS b;
GRANT SELECT ON growth_qa TO authenticated;
INSERT INTO auth.users(id,email,raw_user_meta_data) SELECT a,'growth-qa-'||a||'@example.invalid','{}'::jsonb FROM growth_qa UNION ALL SELECT b,'growth-qa-'||b||'@example.invalid','{}'::jsonb FROM growth_qa;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',(SELECT a::text FROM growth_qa),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE day text:=public.rooted_scoring_date()::text; week text:=date_trunc('week',public.rooted_scoring_date())::date::text; result jsonb;
BEGIN
 IF has_table_privilege('authenticated','public.growth_records','INSERT') OR has_table_privilege('authenticated','public.growth_records','TRUNCATE') OR has_table_privilege('anon','public.growth_records','SELECT') THEN RAISE EXCEPTION 'Overbroad growth permissions'; END IF;
 PERFORM public.save_rooted_growth('definitions','personal','{"why":"My family matters","habits":{"exercise":"Walk after dinner"}}');
 PERFORM public.save_rooted_growth('review',week,'{"worked":"Walking","obstacle":"Phone","change":"Leave it inside","commitment":"Walk after dinner"}');
 PERFORM public.save_rooted_growth('priorities',day,'[{"title":"Walk","pillar":"fitness","when":"After dinner","done":true}]');
 IF (SELECT count(*) FROM public.growth_records)<>3 THEN RAISE EXCEPTION 'Growth did not save'; END IF;
 BEGIN PERFORM public.save_rooted_growth('priorities',(public.rooted_scoring_date()-1)::text,'[]'); RAISE EXCEPTION 'Past priorities accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Only today%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.save_rooted_growth('priorities',day,'[{"title":"a","pillar":"","when":"","done":false},{"title":"b","pillar":"","when":"","done":false},{"title":"c","pillar":"","when":"","done":false},{"title":"d","pillar":"","when":"","done":false}]'); RAISE EXCEPTION 'Fourth priority accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Invalid planning%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.save_rooted_growth('review','2026-02-30','{}'); RAISE EXCEPTION 'Invalid date accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Invalid planning%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.save_rooted_growth('review',(date_trunc('week',public.rooted_scoring_date())::date+7)::text,'{"worked":"","obstacle":"","change":"","commitment":""}'); RAISE EXCEPTION 'Future review accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Future review%' THEN RAISE; END IF; END;
 PERFORM public.import_rooted_growth(jsonb_build_array(
  jsonb_build_object('kind','definitions','key','personal','value','{"why":"Must not overwrite","habits":{}}'::jsonb),
  jsonb_build_object('kind','priorities','key',(public.rooted_scoring_date()-1)::text,'value','[{"title":"Guest history","pillar":"family","when":"","done":false}]'::jsonb)));
 IF (SELECT value->>'why' FROM public.growth_records WHERE kind='definitions')<>'My family matters' THEN RAISE EXCEPTION 'Guest import overwrote account data'; END IF;
 IF has_function_privilege('anon','public.save_rooted_growth(text,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous save exposed'; END IF;
 result:=public.export_rooted_growth_backup_data();
 IF jsonb_array_length(result->'growth')<>4 OR jsonb_array_length(result->'records')<>0 THEN RAISE EXCEPTION 'Growth export or point isolation failed'; END IF;
 PERFORM set_config('request.jwt.claim.sub',(SELECT b::text FROM growth_qa),true);
 IF (SELECT count(*) FROM public.growth_records)<>0 THEN RAISE EXCEPTION 'Cross-account growth leak'; END IF;
 IF jsonb_array_length(public.export_rooted_growth_backup_data()->'growth')<>0 THEN RAISE EXCEPTION 'Cross-account export leak'; END IF;
 PERFORM public.save_rooted_growth('definitions','personal','{"why":"Account B","habits":{}}');
 IF (SELECT count(*) FROM public.growth_records)<>1 THEN RAISE EXCEPTION 'Account B writes not isolated'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub',(SELECT a::text FROM growth_qa),true);
DO $$
DECLARE uid uuid:=(SELECT a FROM growth_qa); backup jsonb; result jsonb; records_before bigint;
BEGIN
 backup:=public.export_rooted_growth_backup_data() || jsonb_build_object('format','rooted-backup','version',2,'owner_id',uid);
 backup:=jsonb_set(backup,'{growth}',backup->'growth'||jsonb_build_array(jsonb_build_object('kind','priorities','key',(public.rooted_scoring_date()-2)::text,'value','[{"title":"Historical priority","pillar":"faith","when":"","done":true}]'::jsonb)));
 SELECT count(*) INTO records_before FROM public.activity_records WHERE user_id=uid;
 PERFORM public.restore_rooted_backup(uid,backup);
 PERFORM public.restore_rooted_backup(uid,backup);
 IF (SELECT count(*) FROM public.growth_records WHERE user_id=uid)<>5 THEN RAISE EXCEPTION 'Growth merge restore failed'; END IF;
 IF (SELECT count(*) FROM public.activity_records WHERE user_id=uid)<>records_before THEN RAISE EXCEPTION 'Growth minted points'; END IF;
 IF has_function_privilege('authenticated','public.restore_rooted_backup(uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Trusted restore exposed'; END IF;
 -- Invalid growth must roll back the entire restoration, including the profile update.
 BEGIN
  PERFORM public.restore_rooted_backup(uid,jsonb_set(jsonb_set(backup,'{profile,display_name}','"Should roll back"'),'{growth}','[{"kind":"priorities","key":"bad","value":{}}]'));
  RAISE EXCEPTION 'Invalid growth restored';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF (SELECT display_name FROM public.profiles WHERE id=uid)='Should roll back' THEN RAISE EXCEPTION 'Restore was not atomic'; END IF;
END $$;
