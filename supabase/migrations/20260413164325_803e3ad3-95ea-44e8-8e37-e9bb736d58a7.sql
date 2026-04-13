
-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'site_manager', 'procurement_officer', 'accountant');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  customer_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update projects" ON public.projects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete projects" ON public.projects FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  standard_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  unit_of_measure TEXT NOT NULL DEFAULT 'Unit',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update products" ON public.products FOR UPDATE TO authenticated USING (true);

-- Sequence for job cost sheet naming
CREATE SEQUENCE public.job_cost_sheet_seq START 1097;

-- Job Cost Sheets table
CREATE TABLE public.job_cost_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'COST-SHEET/' || LPAD(nextval('public.job_cost_sheet_seq')::TEXT, 5, '0'),
  project_id UUID REFERENCES public.projects(id),
  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'confirmed', 'budget_validated', 'approved', 'done')),
  total_planned_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.job_cost_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read job_cost_sheets" ON public.job_cost_sheets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert job_cost_sheets" ON public.job_cost_sheets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update job_cost_sheets" ON public.job_cost_sheets FOR UPDATE TO authenticated USING (true);

-- Job Cost Lines table
CREATE TABLE public.job_cost_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_cost_sheet_id UUID NOT NULL REFERENCES public.job_cost_sheets(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('material', 'labour', 'overhead')),
  description TEXT,
  product_id UUID REFERENCES public.products(id),
  quantity NUMERIC(15,3) NOT NULL DEFAULT 0,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.job_cost_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read job_cost_lines" ON public.job_cost_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert job_cost_lines" ON public.job_cost_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update job_cost_lines" ON public.job_cost_lines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete job_cost_lines" ON public.job_cost_lines FOR DELETE TO authenticated USING (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_job_cost_sheets_updated_at BEFORE UPDATE ON public.job_cost_sheets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed data: Projects
INSERT INTO public.projects (name, location, customer_name, status) VALUES
  ('Wuse Zone 3', 'Wuse, Abuja', 'Federal Housing Authority', 'active'),
  ('Uppertec Homes and Luxury', 'Gwarinpa, Abuja', 'Uppertec Properties Ltd', 'active');

-- Seed data: Products
INSERT INTO public.products (name, standard_price, unit_of_measure) VALUES
  ('Cement', 10400.00, 'Bag'),
  ('Sharp Sand', 180000.00, 'Trip'),
  ('Plaster Sand', 85000.00, 'Trip'),
  ('Granite', 250000.00, 'Trip'),
  ('Iron Rod (12mm)', 5200.00, 'Length'),
  ('Iron Rod (16mm)', 9500.00, 'Length'),
  ('Binding Wire', 800.00, 'Kg'),
  ('Timber (2x3)', 450.00, 'Length'),
  ('Roofing Sheet', 4500.00, 'Sheet'),
  ('Nails (3 inch)', 650.00, 'Kg');

-- Function to handle new user - auto assign admin role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
