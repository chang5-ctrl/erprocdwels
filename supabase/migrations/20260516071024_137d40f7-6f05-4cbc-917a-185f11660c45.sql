
CREATE OR REPLACE FUNCTION public.start_direct_message(_other uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_channel uuid;
BEGIN
  IF v_me IS NULL OR _other IS NULL OR v_me = _other THEN
    RAISE EXCEPTION 'Invalid users';
  END IF;

  SELECT c.id INTO v_channel
  FROM public.chat_channels c
  JOIN public.chat_channel_members m1 ON m1.channel_id = c.id AND m1.user_id = v_me
  JOIN public.chat_channel_members m2 ON m2.channel_id = c.id AND m2.user_id = _other
  WHERE c.is_group = false
  LIMIT 1;

  IF v_channel IS NOT NULL THEN
    RETURN v_channel;
  END IF;

  INSERT INTO public.chat_channels (is_group, created_by) VALUES (false, v_me)
  RETURNING id INTO v_channel;
  INSERT INTO public.chat_channel_members (channel_id, user_id) VALUES (v_channel, v_me), (v_channel, _other);
  RETURN v_channel;
END;
$$;
