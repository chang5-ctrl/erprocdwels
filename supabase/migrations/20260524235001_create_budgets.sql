-- Migration: Create budgets and budget_lines tables
-- Created: 2026-05-24

-- budgets table
CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_number text UNIQUE NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  analytic_account text,
  date_from date,
  date_to date,
  responsible_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'approved')),
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access to budgets" ON public.budgets
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- budget_lines table
CREATE TABLE IF NOT EXISTS public.budget_lines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id uuid REFERENCES public.budgets(id) ON DELETE CASCADE NOT NULL,
  category text CHECK (category IN ('Materials', 'Labour', 'Equipment', 'Overhead', 'Subcontractors', 'Miscellaneous')),
  description text,
  planned_amount numeric(15,2) NOT NULL DEFAULT 0,
  actual_expenditure numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access to budget_lines" ON public.budget_lines
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);