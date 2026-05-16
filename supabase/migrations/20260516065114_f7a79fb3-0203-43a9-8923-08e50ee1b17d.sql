
ALTER TABLE public.job_cost_sheets
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sheet_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS receipt_path text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Validation trigger for status values
CREATE OR REPLACE FUNCTION public.validate_jcs_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_jcs_status ON public.job_cost_sheets;
CREATE TRIGGER trg_validate_jcs_status
BEFORE INSERT OR UPDATE ON public.job_cost_sheets
FOR EACH ROW EXECUTE FUNCTION public.validate_jcs_status();

-- Receipts storage policies on existing documents bucket (folder: cost-sheet-receipts/)
DO $$ BEGIN
  CREATE POLICY "Authenticated read cost sheet receipts"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated upload cost sheet receipts"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
