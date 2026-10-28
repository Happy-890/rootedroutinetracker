-- Execute after migrations 0008-0010 inside a transaction, then ROLLBACK.
DO $$
DECLARE uid uuid:=gen_random_uuid(); eid uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid(); backup jsonb; result jsonb;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(uid,'rooted-qa-'||uid||'@example.invalid','{}');
 BEGIN UPDATE public.profiles SET timezone='Rooted/Invalid' WHERE id=uid; RAISE EXCEPTION 'Timezone guard did not reject';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Invalid profile timezone%' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 PERFORM set_config('rooted.verified_restore','on',true);
 BEGIN INSERT INTO public.activity_records(user_id,local_date,activity) VALUES(uid,public.rooted_scoring_date()-1,'bible'); RAISE EXCEPTION 'Scoring guard did not reject';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Points can only%' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 backup:=jsonb_build_object('format','rooted-backup','version',2,'owner_id',uid,'profile',jsonb_build_object('display_name','QA fixture','timezone','UTC'),
 'records',jsonb_build_array(jsonb_build_object('local_date',public.rooted_scoring_date()-1,'activity','bible')),
 'entries',jsonb_build_array(jsonb_build_object('id',eid,'kind','journal','subtype','freeflow','content',jsonb_build_object('text','QA restore fixture'),'local_date',public.rooted_scoring_date()-1,'created_at',now()-interval '1 day','updated_at',now()-interval '1 day')),
 'reminders',jsonb_build_array(jsonb_build_object('id',rid,'title','QA restore fixture','message','Fixture','delivery_time','20:00','enabled',false)));
 result:=public.restore_rooted_backup(uid,backup);
 IF result<>jsonb_build_object('records',1,'entries',1,'reminders',1) THEN RAISE EXCEPTION 'Incomplete restore: %',result; END IF;
 result:=public.restore_rooted_backup(uid,backup);
 IF result<>jsonb_build_object('records',0,'entries',0,'reminders',0) THEN RAISE EXCEPTION 'Restore duplicated data'; END IF;
 IF (SELECT count(*) FROM public.activity_records WHERE user_id=uid)<>1 THEN RAISE EXCEPTION 'Restoring writing minted extra points'; END IF;
 IF (SELECT created_at FROM public.entries WHERE id=eid)<>now()-interval '1 day' THEN RAISE EXCEPTION 'Writing timestamp changed'; END IF;
 BEGIN
  PERFORM public.restore_rooted_backup(uid,jsonb_set(jsonb_set(backup,'{profile,display_name}','"Should roll back"'),'{records}',jsonb_build_array(jsonb_build_object('local_date',public.rooted_scoring_date()+1,'activity','bible'))));
  RAISE EXCEPTION 'Future scoring record accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Invalid activity%' THEN RAISE; END IF; END;
 IF (SELECT display_name FROM public.profiles WHERE id=uid)<>'QA fixture' THEN RAISE EXCEPTION 'Restore was not atomic'; END IF;
 IF has_function_privilege('authenticated','public.restore_rooted_backup(uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Client can invoke trusted restore'; END IF;
 IF has_function_privilege('authenticated','public.claim_rooted_reminders_v3()','EXECUTE') THEN RAISE EXCEPTION 'Client can claim deliveries'; END IF;
 IF has_table_privilege('anon','public.entries','SELECT') OR has_table_privilege('authenticated','public.entries','TRUNCATE') OR has_table_privilege('authenticated','public.push_signing_config','SELECT') THEN RAISE EXCEPTION 'Overbroad table privileges remain'; END IF;
 IF has_column_privilege('authenticated','public.push_devices','last_test_at','UPDATE') THEN RAISE EXCEPTION 'Client can bypass push throttle'; END IF;
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 result:=public.export_rooted_backup_data();
 IF jsonb_array_length(result->'records')<>1 OR jsonb_array_length(result->'entries')<>1 OR jsonb_array_length(result->'reminders')<>1 THEN RAISE EXCEPTION 'Account snapshot export is incomplete'; END IF;
END $$;

CREATE TEMP TABLE profiles (LIKE public.profiles INCLUDING ALL);
CREATE TEMP TABLE daily_reminders (LIKE public.daily_reminders INCLUDING ALL);
CREATE TEMP TABLE push_devices (LIKE public.push_devices INCLUDING ALL);
CREATE TEMP TABLE reminder_delivery_claims (LIKE public.reminder_delivery_claims INCLUDING ALL);
-- TEMP_FUNCTIONS
DO $$
DECLARE uid uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid(); did uuid:=gen_random_uuid(); first_lease uuid; second_lease uuid; day date;
BEGIN
 INSERT INTO pg_temp.profiles(id,timezone) VALUES(uid,'Rooted/Invalid');
 INSERT INTO pg_temp.daily_reminders(id,user_id,timezone,delivery_time) VALUES(rid,uid,'UTC',to_char(now() AT TIME ZONE 'UTC','HH24:MI'));
 INSERT INTO pg_temp.push_devices(id,user_id,endpoint,p256dh,auth) VALUES(did,uid,'https://web.push.apple.com/fixture','fixture','fixture');
 SELECT c.lease_token,c.local_date INTO first_lease,day FROM pg_temp.claim_rooted_reminders_v3() c;
 IF first_lease IS NULL THEN RAISE EXCEPTION 'Invalid profile timezone broke scheduler fallback'; END IF;
 IF (SELECT count(*) FROM pg_temp.claim_rooted_reminders_v3())<>0 THEN RAISE EXCEPTION 'Concurrent job reclaimed active lease'; END IF;
 PERFORM pg_temp.finish_rooted_delivery(rid,did,day,first_lease,false,true,429);
 IF (SELECT status FROM pg_temp.reminder_delivery_claims)<>'pending' THEN RAISE EXCEPTION 'Transient failure not retried'; END IF;
 IF (SELECT count(*) FROM pg_temp.claim_rooted_reminders_v3())<>0 THEN RAISE EXCEPTION 'Backoff ignored'; END IF;
 UPDATE pg_temp.reminder_delivery_claims SET next_attempt_at=now()-interval '1 second';
 UPDATE pg_temp.daily_reminders SET delivery_time=to_char((now() AT TIME ZONE 'UTC')+interval '1 minute','HH24:MI');
 SELECT c.lease_token INTO second_lease FROM pg_temp.claim_rooted_reminders_v3() c;
 IF second_lease IS NULL THEN RAISE EXCEPTION 'Retry incorrectly required original due minute'; END IF;
 IF pg_temp.finish_rooted_delivery(rid,did,day,first_lease,true,false,201) THEN RAISE EXCEPTION 'Stale worker changed a newer lease'; END IF;
 PERFORM pg_temp.finish_rooted_delivery(rid,did,day,second_lease,true,false,201);
 IF (SELECT count(*) FROM pg_temp.claim_rooted_reminders_v3())<>0 THEN RAISE EXCEPTION 'Successful delivery replayed'; END IF;
 DELETE FROM pg_temp.reminder_delivery_claims;
 UPDATE pg_temp.daily_reminders SET delivery_time=to_char(now() AT TIME ZONE 'UTC','HH24:MI');
 PERFORM * FROM pg_temp.claim_rooted_reminders_v3();
 UPDATE pg_temp.reminder_delivery_claims SET lease_until=now()-interval '1 second';
 IF (SELECT count(*) FROM pg_temp.claim_rooted_reminders_v3())<>1 THEN RAISE EXCEPTION 'Abandoned lease was not recovered'; END IF;
 UPDATE pg_temp.reminder_delivery_claims SET attempts=4,lease_until=now()-interval '1 second';
 IF (SELECT count(*) FROM pg_temp.claim_rooted_reminders_v3())<>0 THEN RAISE EXCEPTION 'Attempt limit ignored'; END IF;
 UPDATE pg_temp.reminder_delivery_claims SET attempts=1,expires_at=now()-interval '1 second';
 IF (SELECT count(*) FROM pg_temp.claim_rooted_reminders_v3())<>0 THEN RAISE EXCEPTION 'Expired reminder retried'; END IF;
 UPDATE pg_temp.reminder_delivery_claims SET expires_at=now()+interval '1 minute';
 UPDATE pg_temp.daily_reminders SET enabled=false;
 IF (SELECT count(*) FROM pg_temp.claim_rooted_reminders_v3())<>0 THEN RAISE EXCEPTION 'Paused reminder retried'; END IF;
 UPDATE pg_temp.daily_reminders SET enabled=true;
 UPDATE pg_temp.push_devices SET user_id=gen_random_uuid();
 IF (SELECT count(*) FROM pg_temp.claim_rooted_reminders_v3())<>0 THEN RAISE EXCEPTION 'Delivery crossed account ownership'; END IF;
END $$;
SELECT true AS reliability_checks_passed;
