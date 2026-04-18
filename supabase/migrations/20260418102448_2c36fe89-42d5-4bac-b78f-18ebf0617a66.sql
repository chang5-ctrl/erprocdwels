
-- =========== USER PROFILES ===========
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  job_title TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update own profile"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert profiles"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== ACTIVITY LOGS ===========
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all activity"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated insert activity"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =========== LOGIN LOGS ===========
CREATE TABLE public.login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_logs_user ON public.login_logs(user_id, logged_in_at DESC);

ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view login logs"
  ON public.login_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own login logs"
  ON public.login_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated insert login logs"
  ON public.login_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- =========== ACTUALS ON COST LINES ===========
ALTER TABLE public.job_cost_lines
  ADD COLUMN actual_quantity NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN actual_purchased_cost NUMERIC NOT NULL DEFAULT 0;

-- =========== UPDATE handle_new_user TO CREATE PROFILE ===========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  -- Only assign admin to the very first user; subsequent users default to site_manager
  IF NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'site_manager'));
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========== BACKFILL profiles for existing users ===========
INSERT INTO public.user_profiles (user_id, full_name)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', email)
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_profiles);
