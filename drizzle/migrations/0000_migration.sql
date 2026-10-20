CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT 'America/Chicago',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.activity_records (
  user_id uuid NOT NULL,
  local_date date NOT NULL,
  activity text NOT NULL CHECK (activity IN ('bible','prayer','marriage','relationship','exercise','nutrition','learn','plan','gratitude','journal')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, local_date, activity)
);
GRANT SELECT, INSERT, DELETE ON public.activity_records TO authenticated;
GRANT ALL ON public.activity_records TO service_role;
ALTER TABLE public.activity_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activity select" ON public.activity_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own activity insert" ON public.activity_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own activity delete" ON public.activity_records FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.entries (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('learn','gratitude','journal')),
  subtype text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  local_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entries_user_date ON public.entries(user_id, local_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO authenticated;
GRANT ALL ON public.entries TO service_role;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own entries select" ON public.entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own entries insert" ON public.entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own entries update" ON public.entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own entries delete" ON public.entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Editing must never move an entry's earned date or owner
CREATE OR REPLACE FUNCTION public.entries_guard_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.local_date := OLD.local_date;
  NEW.user_id := OLD.user_id;
  NEW.kind := OLD.kind;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER entries_guard BEFORE UPDATE ON public.entries
FOR EACH ROW EXECUTE FUNCTION public.entries_guard_update();