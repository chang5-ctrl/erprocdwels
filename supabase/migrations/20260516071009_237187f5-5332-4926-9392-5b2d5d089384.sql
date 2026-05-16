
CREATE TABLE public.chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  is_group boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, user_id)
);
CREATE INDEX idx_ccm_user ON public.chat_channel_members(user_id);
CREATE INDEX idx_ccm_channel ON public.chat_channel_members(channel_id);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cm_channel_time ON public.chat_messages(channel_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.is_channel_member(_channel uuid, _user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_channel_members WHERE channel_id = _channel AND user_id = _user)
$$;

ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members or admins view channels" ON public.chat_channels FOR SELECT TO authenticated
USING (public.is_channel_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated create channels" ON public.chat_channels FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins update channels" ON public.chat_channels FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete channels" ON public.chat_channels FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "View channel members of own channels" ON public.chat_channel_members FOR SELECT TO authenticated
USING (public.is_channel_member(channel_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin or self insert membership" ON public.chat_channel_members FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);
CREATE POLICY "Self update membership" ON public.chat_channel_members FOR UPDATE TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "Admin or self delete membership" ON public.chat_channel_members FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE POLICY "Members read messages" ON public.chat_messages FOR SELECT TO authenticated
USING (public.is_channel_member(channel_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members send messages" ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sender_id AND public.is_channel_member(channel_id, auth.uid()));
CREATE POLICY "Sender delete own messages" ON public.chat_messages FOR DELETE TO authenticated
USING (auth.uid() = sender_id OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_channel_members REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channel_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channels;

DO $$
DECLARE
  v_channel uuid;
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF v_owner IS NULL THEN
    SELECT user_id INTO v_owner FROM public.user_profiles LIMIT 1;
  END IF;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.chat_channels (name, is_group, created_by)
    VALUES ('Wuse Zone 3 Team', true, v_owner)
    RETURNING id INTO v_channel;
    INSERT INTO public.chat_channel_members (channel_id, user_id)
    SELECT v_channel, user_id FROM public.user_profiles
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
