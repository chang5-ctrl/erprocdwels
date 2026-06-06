
-- ============================================
-- MATERIAL CATEGORIES
-- ============================================
CREATE TABLE public.material_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_categories TO authenticated;
GRANT ALL ON public.material_categories TO service_role;
ALTER TABLE public.material_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read material_categories" ON public.material_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage material_categories" ON public.material_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'procurement_officer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'procurement_officer'));

INSERT INTO public.material_categories (name, sort_order) VALUES
  ('Cement & Concrete', 10),
  ('Steel & Iron', 20),
  ('Timber & Wood', 30),
  ('Sand & Aggregates', 40),
  ('Blocks & Bricks', 50),
  ('Roofing Materials', 60),
  ('Electrical Materials', 70),
  ('Plumbing Materials', 80),
  ('Finishing Materials', 90),
  ('Heavy Equipment', 100),
  ('Safety Equipment', 110),
  ('Miscellaneous', 120);

-- ============================================
-- MATERIALS
-- ============================================
CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category_id uuid REFERENCES public.material_categories(id) ON DELETE SET NULL,
  uom text NOT NULL DEFAULT 'pcs',
  unit_cost numeric NOT NULL DEFAULT 0,
  supplier_id uuid,
  min_stock numeric NOT NULL DEFAULT 0,
  current_stock numeric NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX materials_category_idx ON public.materials(category_id);
CREATE INDEX materials_name_idx ON public.materials(lower(name));
CREATE INDEX materials_active_idx ON public.materials(deleted_at) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full materials" ON public.materials FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER materials_set_updated_at BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- MATERIAL MOVEMENTS
-- ============================================
CREATE TABLE public.material_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('in','out','adjust')),
  quantity numeric NOT NULL,
  unit_cost numeric,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX material_movements_material_idx ON public.material_movements(material_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_movements TO authenticated;
GRANT ALL ON public.material_movements TO service_role;
ALTER TABLE public.material_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full material_movements" ON public.material_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Keep materials.current_stock in sync with movements
CREATE OR REPLACE FUNCTION public.apply_material_movement()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE delta numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    delta := CASE NEW.movement_type
      WHEN 'in' THEN NEW.quantity
      WHEN 'out' THEN -NEW.quantity
      WHEN 'adjust' THEN NEW.quantity
    END;
    UPDATE public.materials SET current_stock = current_stock + delta, updated_at = now()
      WHERE id = NEW.material_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    delta := CASE OLD.movement_type
      WHEN 'in' THEN -OLD.quantity
      WHEN 'out' THEN OLD.quantity
      WHEN 'adjust' THEN -OLD.quantity
    END;
    UPDATE public.materials SET current_stock = current_stock + delta, updated_at = now()
      WHERE id = OLD.material_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER material_movements_apply
  AFTER INSERT OR DELETE ON public.material_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_material_movement();

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','success','warning','error')),
  entity_type text,
  entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON public.notifications(user_id) WHERE is_read = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or admin read notifications" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Own update notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own or admin delete notifications" ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
