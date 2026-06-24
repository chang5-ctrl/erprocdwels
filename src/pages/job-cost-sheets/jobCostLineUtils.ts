export type JobCostLineLike = {
  job_type: string;
  description: string;
  material_name: string;
  worker_name: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  total_cost: number;
};

export function buildJobCostLinePayload({
  job_cost_sheet_id,
  line,
}: {
  job_cost_sheet_id: string;
  line: JobCostLineLike;
}) {
  const productText = line.job_type === 'labour'
    ? line.worker_name?.trim() || null
    : line.material_name?.trim() || null;

  return {
    job_cost_sheet_id,
    job_type: line.job_type,
    description: line.description?.trim() || null,
    product: productText,
    product_id: line.product_id || null,
    quantity: line.quantity,
    unit_price: line.unit_price,
    total_cost: line.total_cost,
    tab_type: line.job_type === 'material' ? 'materials' : line.job_type === 'labour' ? 'labours' : 'overhead',
  };
}
