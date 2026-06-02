
-- 1. PRIVILEGE_ESCALATION: explicit admin-only write policies on user_roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. EXPOSED_SENSITIVE_DATA: restrict supplier writes to admins / procurement
DROP POLICY IF EXISTS "Authenticated insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated update suppliers" ON public.suppliers;
CREATE POLICY "Admin or procurement insert suppliers" ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'procurement_officer'));
CREATE POLICY "Admin or procurement update suppliers" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'procurement_officer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'procurement_officer'));

-- 3. STORAGE ownership: scope documents bucket reads/deletes to uploader's folder
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read documents storage" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated insert documents storage" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete documents storage" ON storage.objects;
DROP POLICY IF EXISTS "Uploader read documents storage" ON storage.objects;
DROP POLICY IF EXISTS "Uploader delete documents storage" ON storage.objects;

CREATE POLICY "Documents read own or admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.storage_path = storage.objects.name
      )
    )
  );

CREATE POLICY "Documents insert own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Documents delete own or admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- 4. user_profiles cross-user read: allow authenticated to read basic profile info
DROP POLICY IF EXISTS "Users view own profile" ON public.user_profiles;
CREATE POLICY "Authenticated read profiles" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (true);

-- 5. Revoke SECURITY DEFINER function EXECUTE from anon / public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_direct_message(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.start_direct_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 6. Realtime authorization: restrict subscriptions to channel members
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can receive broadcasts for own channels" ON realtime.messages;
CREATE POLICY "Authenticated can receive broadcasts for own channels"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    -- Postgres changes topic uses table/schema metadata; restrict via extension field
    (extension = 'postgres_changes' AND auth.uid() IS NOT NULL)
    OR (
      extension IN ('broadcast', 'presence')
      AND EXISTS (
        SELECT 1 FROM public.chat_channel_members m
        WHERE m.user_id = auth.uid()
          AND m.channel_id::text = topic
      )
    )
  );
