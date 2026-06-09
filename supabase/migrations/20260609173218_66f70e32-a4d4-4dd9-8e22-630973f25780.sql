
-- Add metadata to channels for general/project group channels
ALTER TABLE public.chat_channels
  ADD COLUMN IF NOT EXISTS channel_type text NOT NULL DEFAULT 'dm',
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS chat_channels_one_general
  ON public.chat_channels((channel_type)) WHERE channel_type = 'general';
CREATE UNIQUE INDEX IF NOT EXISTS chat_channels_one_per_project
  ON public.chat_channels(project_id) WHERE channel_type = 'project';

-- Backfill: tag existing
UPDATE public.chat_channels SET channel_type = 'dm' WHERE is_group = false AND channel_type = 'dm';
UPDATE public.chat_channels SET channel_type = 'group' WHERE is_group = true AND channel_type = 'dm';

-- Remove ghost members (users that no longer have a profile)
DELETE FROM public.chat_channel_members m
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id = m.user_id);

-- Remove DM channels that have fewer than 2 real members
DELETE FROM public.chat_channels c
WHERE c.is_group = false
  AND (SELECT count(*) FROM public.chat_channel_members m WHERE m.channel_id = c.id) < 2;

-- Ensure one general channel exists and add all staff
DO $$
DECLARE v_general uuid; v_admin uuid;
BEGIN
  SELECT user_id INTO v_admin FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  SELECT id INTO v_general FROM public.chat_channels WHERE channel_type = 'general' LIMIT 1;
  IF v_general IS NULL THEN
    INSERT INTO public.chat_channels (name, is_group, channel_type, created_by)
    VALUES ('General', true, 'general', v_admin)
    RETURNING id INTO v_general;
  END IF;
  INSERT INTO public.chat_channel_members (channel_id, user_id)
  SELECT v_general, p.user_id FROM public.user_profiles p
  ON CONFLICT DO NOTHING;
END $$;

-- Ensure a project channel per existing project, with all staff
DO $$
DECLARE r record; v_channel uuid; v_admin uuid;
BEGIN
  SELECT user_id INTO v_admin FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  FOR r IN SELECT id, name FROM public.projects WHERE deleted_at IS NULL LOOP
    SELECT id INTO v_channel FROM public.chat_channels
      WHERE channel_type = 'project' AND project_id = r.id LIMIT 1;
    IF v_channel IS NULL THEN
      INSERT INTO public.chat_channels (name, is_group, channel_type, project_id, created_by)
      VALUES (r.name, true, 'project', r.id, v_admin)
      RETURNING id INTO v_channel;
    END IF;
    INSERT INTO public.chat_channel_members (channel_id, user_id)
    SELECT v_channel, p.user_id FROM public.user_profiles p
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Trigger: auto-create project channel on project insert + add all staff
CREATE OR REPLACE FUNCTION public.create_project_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_channel uuid; v_admin uuid;
BEGIN
  SELECT user_id INTO v_admin FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  INSERT INTO public.chat_channels (name, is_group, channel_type, project_id, created_by)
  VALUES (NEW.name, true, 'project', NEW.id, COALESCE(v_admin, NEW.created_by))
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_channel;
  IF v_channel IS NULL THEN
    SELECT id INTO v_channel FROM public.chat_channels
      WHERE channel_type = 'project' AND project_id = NEW.id;
  END IF;
  INSERT INTO public.chat_channel_members (channel_id, user_id)
  SELECT v_channel, p.user_id FROM public.user_profiles p
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_project_channel ON public.projects;
CREATE TRIGGER trg_project_channel
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.create_project_channel();

-- Trigger: when new profile is created, add to general + every project channel
CREATE OR REPLACE FUNCTION public.add_user_to_group_channels()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.chat_channel_members (channel_id, user_id)
  SELECT c.id, NEW.user_id FROM public.chat_channels c
  WHERE c.channel_type IN ('general','project')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_user_group_channels ON public.user_profiles;
CREATE TRIGGER trg_user_group_channels
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.add_user_to_group_channels();

-- Ensure REPLICA IDENTITY FULL for realtime payloads
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_channels REPLICA IDENTITY FULL;
ALTER TABLE public.chat_channel_members REPLICA IDENTITY FULL;
