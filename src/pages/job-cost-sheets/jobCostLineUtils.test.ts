import { describe, it, expect } from 'vitest';
import { buildJobCostLinePayload } from './jobCostLineUtils';

describe('buildJobCostLinePayload', () => {
  it('maps material rows to schema-safe Supabase fields', () => {
    const payload = buildJobCostLinePayload({
      job_cost_sheet_id: 'sheet-1',
      line: {
        job_type: 'material',
        description: 'Cement bags',
        material_name: 'Cement',
        worker_name: '',
        product_id: null,
        quantity: 3,
        unit_price: 5000,
        total_cost: 15000,
      },
    });

    expect(payload).toMatchObject({
      job_cost_sheet_id: 'sheet-1',
      job_type: 'material',
      description: 'Cement bags',
      product: 'Cement',
      quantity: 3,
      unit_price: 5000,
      total_cost: 15000,
      tab_type: 'materials',
    });
  });

  it('stores labour names in the product field and uses the labour tab type', () => {
    const payload = buildJobCostLinePayload({
      job_cost_sheet_id: 'sheet-2',
      line: {
        job_type: 'labour',
        description: 'Excavation crew',
        material_name: '',
        worker_name: 'Musa',
        product_id: null,
        quantity: 8,
        unit_price: 2500,
        total_cost: 20000,
      },
    });

    expect(payload).toMatchObject({
      job_cost_sheet_id: 'sheet-2',
      job_type: 'labour',
      description: 'Excavation crew',
      product: 'Musa',
      quantity: 8,
      unit_price: 2500,
      total_cost: 20000,
      tab_type: 'labours',
    });
  });
});
