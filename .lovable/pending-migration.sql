-- PENDING: apply with lov_database--migration (name: lock_down_points_and_account_deletion) once the hosted database is resumed.
REVOKE INSERT, DELETE ON public.activity_records FROM authenticated;
DROP POLICY IF EXISTS "own activity insert" ON public.activity_records;
DROP POLICY IF EXISTS "own activity delete" ON public.activity_records;

CREATE OR REPLACE FUNCTION public.award_entry_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN INSERT INTO public.activity_records (user_id, local_date, activity) VALUES (NEW.user_id, NEW.local_date, NEW.kind) ON CONFLICT (user_id, local_date, activity) DO NOTHING; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.award_entry_activity() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_rooted_activity_date() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_OP = 'DELETE' AND current_setting('rooted.account_delete', true) = 'on' THEN RETURN OLD; END IF;
 IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Activity records cannot be edited'; END IF;
 IF TG_OP = 'DELETE' THEN
  IF OLD.local_date <> public.rooted_scoring_date() THEN RAISE EXCEPTION 'This scoring day is closed. No catch-up after midnight Central time.'; END IF;
  RETURN OLD;
 END IF;
 IF NEW.local_date <> public.rooted_scoring_date() THEN RAISE EXCEPTION 'Points can only be earned today. No catch-up after midnight Central time.'; END IF;
 IF NEW.activity NOT IN ('bible','prayer','marriage','relationship','exercise','nutrition','learn','plan','gratitude','journal') THEN RAISE EXCEPTION 'Unknown activity'; END IF;
 NEW.created_at := clock_timestamp(); RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.toggle_rooted_activity(p_activity text, p_on boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF p_activity NOT IN ('bible','prayer','marriage','relationship','exercise','nutrition','plan') THEN RAISE EXCEPTION 'This activity is earned by saving an entry'; END IF;
  IF p_on THEN
    INSERT INTO public.activity_records (user_id, local_date, activity) VALUES (auth.uid(), public.rooted_scoring_date(), p_activity) ON CONFLICT (user_id, local_date, activity) DO NOTHING;
  ELSE
    DELETE FROM public.activity_records WHERE user_id = auth.uid() AND local_date = public.rooted_scoring_date() AND activity = p_activity;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.toggle_rooted_activity(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_rooted_activity(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.import_rooted_activity(p_activities text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  INSERT INTO public.activity_records (user_id, local_date, activity)
  SELECT auth.uid(), public.rooted_scoring_date(), a FROM unnest(p_activities) AS a
  WHERE a IN ('bible','prayer','marriage','relationship','exercise','nutrition','plan')
  ON CONFLICT (user_id, local_date, activity) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.import_rooted_activity(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_rooted_activity(text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_rooted_account_data(p_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('rooted.account_delete', 'on', true);
  DELETE FROM public.activity_records WHERE user_id = p_user;
  DELETE FROM public.entries WHERE user_id = p_user;
  DELETE FROM public.growth_records WHERE user_id = p_user;
  DELETE FROM public.daily_reminders WHERE user_id = p_user;
  DELETE FROM public.reminder_preferences WHERE user_id = p_user;
  DELETE FROM public.push_devices WHERE user_id = p_user;
  DELETE FROM public.app_event_logs WHERE user_id = p_user;
  DELETE FROM public.profiles WHERE id = p_user;
  PERFORM set_config('rooted.account_delete', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.delete_rooted_account_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_rooted_account_data(uuid) TO service_role;
