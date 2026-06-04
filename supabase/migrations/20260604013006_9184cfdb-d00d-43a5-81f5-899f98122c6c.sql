
-- Sequences for auto-IDs
CREATE SEQUENCE IF NOT EXISTS public.dsr_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.vo_seq START 1;

-- ============ DAILY SITE REPORTS ============
CREATE TABLE public.daily_site_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dsr_number text NOT NULL DEFAULT ('DSR/' || lpad(nextval('public.dsr_seq')::text, 5, '0')),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  site_manager_id uuid,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  weather text,
  work_status text,
  status text NOT NULL DEFAULT 'draft',
  tomorrow_plan text,
  tomorrow_materials text,
  tomorrow_workforce integer,
  tomorrow_special text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_site_reports TO authenticated;
GRANT ALL ON public.daily_site_reports TO service_role;
ALTER TABLE public.daily_site_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to daily_site_reports" ON public.daily_site_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_dsr_updated BEFORE UPDATE ON public.daily_site_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.dsr_workforce (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dsr_id uuid NOT NULL REFERENCES public.daily_site_reports(id) ON DELETE CASCADE,
  worker_name text,
  trade text,
  hours_worked numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsr_workforce TO authenticated;
GRANT ALL ON public.dsr_workforce TO service_role;
ALTER TABLE public.dsr_workforce ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to dsr_workforce" ON public.dsr_workforce FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.dsr_work (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dsr_id uuid NOT NULL REFERENCES public.daily_site_reports(id) ON DELETE CASCADE,
  activity text,
  location text,
  pct_complete numeric DEFAULT 0,
  quantity numeric,
  uom text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsr_work TO authenticated;
GRANT ALL ON public.dsr_work TO service_role;
ALTER TABLE public.dsr_work ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to dsr_work" ON public.dsr_work FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.dsr_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dsr_id uuid NOT NULL REFERENCES public.daily_site_reports(id) ON DELETE CASCADE,
  material text,
  quantity_used numeric DEFAULT 0,
  uom text,
  remaining_on_site numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsr_materials TO authenticated;
GRANT ALL ON public.dsr_materials TO service_role;
ALTER TABLE public.dsr_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to dsr_materials" ON public.dsr_materials FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.dsr_equipment (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dsr_id uuid NOT NULL REFERENCES public.daily_site_reports(id) ON DELETE CASCADE,
  equipment_name text,
  equipment_type text,
  operator text,
  hours_used numeric DEFAULT 0,
  condition text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsr_equipment TO authenticated;
GRANT ALL ON public.dsr_equipment TO service_role;
ALTER TABLE public.dsr_equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to dsr_equipment" ON public.dsr_equipment FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.dsr_visitors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dsr_id uuid NOT NULL REFERENCES public.daily_site_reports(id) ON DELETE CASCADE,
  visitor_name text,
  organisation text,
  purpose text,
  time_in text,
  time_out text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsr_visitors TO authenticated;
GRANT ALL ON public.dsr_visitors TO service_role;
ALTER TABLE public.dsr_visitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to dsr_visitors" ON public.dsr_visitors FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.dsr_issues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dsr_id uuid NOT NULL REFERENCES public.daily_site_reports(id) ON DELETE CASCADE,
  issue_type text,
  description text,
  priority text,
  action_required text,
  responsible_person text,
  target_resolution_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsr_issues TO authenticated;
GRANT ALL ON public.dsr_issues TO service_role;
ALTER TABLE public.dsr_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to dsr_issues" ON public.dsr_issues FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ VARIATION ORDERS ============
CREATE TABLE public.variation_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vo_number text NOT NULL DEFAULT ('VO/' || lpad(nextval('public.vo_seq')::text, 5, '0')),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  requested_by uuid,
  date_requested date NOT NULL DEFAULT CURRENT_DATE,
  variation_type text,
  priority text,
  is_change_order boolean DEFAULT false,
  description text,
  reason text,
  impact text,
  vat_pct numeric DEFAULT 0,
  additional_days integer DEFAULT 0,
  revised_completion_date date,
  justification text,
  drawing_refs text,
  spec_refs text,
  site_manager_recommendation text,
  site_manager_by uuid,
  site_manager_at timestamptz,
  project_manager_review text,
  project_manager_by uuid,
  project_manager_at timestamptz,
  client_status text DEFAULT 'pending',
  client_by uuid,
  client_at timestamptz,
  admin_status text DEFAULT 'pending',
  admin_by uuid,
  admin_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.variation_orders TO authenticated;
GRANT ALL ON public.variation_orders TO service_role;
ALTER TABLE public.variation_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to variation_orders" ON public.variation_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_vo_updated BEFORE UPDATE ON public.variation_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.variation_order_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vo_id uuid NOT NULL REFERENCES public.variation_orders(id) ON DELETE CASCADE,
  item text,
  description text,
  quantity numeric DEFAULT 0,
  uom text,
  unit_rate numeric DEFAULT 0,
  amount numeric GENERATED ALWAYS AS (COALESCE(quantity,0) * COALESCE(unit_rate,0)) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.variation_order_lines TO authenticated;
GRANT ALL ON public.variation_order_lines TO service_role;
ALTER TABLE public.variation_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to variation_order_lines" ON public.variation_order_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ MILESTONES ============
CREATE TABLE public.milestones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  milestone_type text,
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  pct_complete numeric NOT NULL DEFAULT 0,
  responsible_id uuid,
  budget_allocated numeric DEFAULT 0,
  actual_cost numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'not_started',
  dependencies jsonb DEFAULT '[]'::jsonb,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestones TO authenticated;
GRANT ALL ON public.milestones TO service_role;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to milestones" ON public.milestones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ms_updated BEFORE UPDATE ON public.milestones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.milestone_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  milestone_id uuid NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  name text NOT NULL,
  assigned_to uuid,
  due_date date,
  status text NOT NULL DEFAULT 'todo',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestone_tasks TO authenticated;
GRANT ALL ON public.milestone_tasks TO service_role;
ALTER TABLE public.milestone_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to milestone_tasks" ON public.milestone_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
