-- Migration: Upgrade job_cost_lines table (add columns if not present)
-- Created: 2026-05-24
-- Note: table name confirmed as job_cost_lines from current schema (types.ts)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_cost_lines' AND column_name = 'tab_type') THEN
    ALTER TABLE public.job_cost_lines ADD COLUMN tab_type text CHECK (tab_type IN ('materials', 'labours', 'overhead'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_cost_lines' AND column_name = 'job_type') THEN
    ALTER TABLE public.job_cost_lines ADD COLUMN job_type text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_cost_lines' AND column_name = 'product') THEN
    ALTER TABLE public.job_cost_lines ADD COLUMN product text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_cost_lines' AND column_name = 'planned_qty') THEN
    ALTER TABLE public.job_cost_lines ADD COLUMN planned_qty numeric(15,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_cost_lines' AND column_name = 'uom') THEN
    ALTER TABLE public.job_cost_lines ADD COLUMN uom text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_cost_lines' AND column_name = 'cost_per_unit') THEN
    ALTER TABLE public.job_cost_lines ADD COLUMN cost_per_unit numeric(15,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_cost_lines' AND column_name = 'actual_requisition_qty') THEN
    ALTER TABLE public.job_cost_lines ADD COLUMN actual_requisition_qty numeric(15,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_cost_lines' AND column_name = 'actual_purchased_qty') THEN
    ALTER TABLE public.job_cost_lines ADD COLUMN actual_purchased_qty numeric(15,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_cost_lines' AND column_name = 'actual_purchased_cost') THEN
    ALTER TABLE public.job_cost_lines ADD COLUMN actual_purchased_cost numeric(15,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_cost_lines' AND column_name = 'actual_vendor_bill_qty') THEN
    ALTER TABLE public.job_cost_lines ADD COLUMN actual_vendor_bill_qty numeric(15,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_cost_lines' AND column_name = 'actual_vendor_bill_cost') THEN
    ALTER TABLE public.job_cost_lines ADD COLUMN actual_vendor_bill_cost numeric(15,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_cost_lines' AND column_name = 'invoice_subtotal') THEN
    ALTER TABLE public.job_cost_lines ADD COLUMN invoice_subtotal numeric(15,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_cost_lines' AND column_name = 'cost_price_subtotal') THEN
    ALTER TABLE public.job_cost_lines ADD COLUMN cost_price_subtotal numeric(15,2) DEFAULT 0;
  END IF;
END $$;

-- Note: Some columns like job_type already exist; migration is fully idempotent.
COMMIT;