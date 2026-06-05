
-- Phase 1: soft-delete columns on every recoverable table
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'projects','job_cost_sheets','job_cost_lines','budgets','budget_lines',
    'requisitions','requisition_lines','suppliers','documents',
    'daily_site_reports','variation_orders','milestones',
    'user_profiles','products','chat_messages','chat_channels'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamptz', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_by uuid', t);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (deleted_at) WHERE deleted_at IS NOT NULL',
      t || '_deleted_at_idx', t
    );
  END LOOP;
END $$;
