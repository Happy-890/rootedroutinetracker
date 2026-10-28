-- Run in a transaction using a pg_temp copy of migration 0007's function.
-- These fixtures never touch application records or send notifications.
CREATE TEMP TABLE profiles (id uuid, timezone text);
CREATE TEMP TABLE daily_reminders (id uuid, user_id uuid, timezone text, delivery_time text, enabled boolean, legacy_source boolean, title text, message text);
CREATE TEMP TABLE push_devices (id uuid, user_id uuid, last_sent_date date, endpoint text, p256dh text, auth text);
CREATE TEMP TABLE reminder_delivery_claims (reminder_id uuid, device_id uuid, local_date date, PRIMARY KEY (reminder_id,device_id,local_date));
INSERT INTO pg_temp.profiles VALUES ('00000000-0000-0000-0000-000000000001', 'UTC');
INSERT INTO pg_temp.push_devices VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',NULL,'fixture','','');
INSERT INTO pg_temp.daily_reminders VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Etc/GMT+5',to_char(now() AT TIME ZONE 'UTC','HH24:MI'),true,false,'Fixture','Fixture');
DO $$
BEGIN
 IF (SELECT count(*) FROM pg_temp.claim_rooted_reminders_v2()) <> 1 THEN RAISE EXCEPTION 'Profile must override stored timezone'; END IF;
 IF (SELECT count(*) FROM pg_temp.claim_rooted_reminders_v2()) <> 0 THEN RAISE EXCEPTION 'Duplicate delivery claimed'; END IF;
 DELETE FROM pg_temp.reminder_delivery_claims;
 UPDATE pg_temp.profiles SET timezone='Etc/GMT+5';
 IF (SELECT count(*) FROM pg_temp.claim_rooted_reminders_v2()) <> 0 THEN RAISE EXCEPTION 'Profile changes must affect existing schedules'; END IF;
 UPDATE pg_temp.daily_reminders SET delivery_time=to_char(now() AT TIME ZONE 'Etc/GMT+5','HH24:MI');
 IF (SELECT count(*) FROM pg_temp.claim_rooted_reminders_v2()) <> 1 THEN RAISE EXCEPTION 'New profile timezone not used'; END IF;
 DELETE FROM pg_temp.reminder_delivery_claims;
 DELETE FROM pg_temp.profiles;
 IF (SELECT count(*) FROM pg_temp.claim_rooted_reminders_v2()) <> 1 THEN RAISE EXCEPTION 'Legacy timezone fallback failed'; END IF;
 DELETE FROM pg_temp.reminder_delivery_claims;
 UPDATE pg_temp.daily_reminders SET enabled=false;
 IF (SELECT count(*) FROM pg_temp.claim_rooted_reminders_v2()) <> 0 THEN RAISE EXCEPTION 'Paused reminders must stay paused'; END IF;
 UPDATE pg_temp.daily_reminders SET enabled=true,legacy_source=true;
 UPDATE pg_temp.push_devices SET last_sent_date=(now() AT TIME ZONE 'Etc/GMT+5')::date;
 IF (SELECT count(*) FROM pg_temp.claim_rooted_reminders_v2()) <> 0 THEN RAISE EXCEPTION 'Legacy delivery guard failed'; END IF;
END $$;
SELECT true AS profile_timezone_checks_passed;
