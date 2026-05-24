-- Migration: Create requisitions and requisition_lines tables
-- Created: 2026-05-24

-- requisitions table
CREATE TABLE IF NOT EXISTS public.requisitions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requisition_number text UNIQUE NOT NULL,
  employee_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  department text,
  responsible_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  task_job_order text,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  requisition_date date NOT NULL,
  received_date date,
  deadline date,
  analytic_account text,
  is_change_order boolean DEFAULT false,
  requisition_type text CHECK (requisition_type IN ('Labour', 'Materials', 'Equipment', 'Overhead')),
  status text DEFAULT 'new' CHECK (status IN ('new', 'site_manager_confirmed', 'procurement_review', 'approved', 'done')),
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.requisitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access to requisitions" ON public.requisitions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- requisition_lines table
CREATE TABLE IF NOT EXISTS public.requisition_lines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requisition_id uuid REFERENCES public.requisitions(id) ON DELETE CASCADE NOT NULL,
  requisition_action text CHECK (requisition_action IN ('Purchase Order', 'Internal Transfer')),
  product text,
  job_cost_center_id uuid REFERENCES public.job_cost_sheets(id) ON DELETE SET NULL,
  job_cost_line text,
  description text,
  quantity numeric(15,2) NOT NULL DEFAULT 0,
  uom text,
  unit_cost numeric(15,2) NOT NULL DEFAULT 0,
  total numeric(15,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.requisition_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access to requisition_lines" ON public.requisition_lines
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);