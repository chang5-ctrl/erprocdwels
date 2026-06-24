export function buildRequisitionPayload(form: Record<string, any>, createdBy: string | null | undefined) {
  return {
    requisition_number: '',
    requisition_date: new Date().toISOString().slice(0, 10),
    project_id: form.project_id ?? null,
    requisition_type: form.requisition_type ?? 'Materials',
    employee_id: form.employee_id ?? null,
    department: form.department ?? null,
    deadline: form.deadline ?? null,
    is_change_order: !!form.is_change_order,
    reason: form.reason ?? null,
    status: 'new',
    created_by: createdBy ?? null,
  };
}
