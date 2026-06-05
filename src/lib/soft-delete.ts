import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activity';

// Tables that support soft delete (Phase 1)
export const SOFT_DELETE_TABLES = [
  'projects',
  'job_cost_sheets',
  'job_cost_lines',
  'budgets',
  'budget_lines',
  'requisitions',
  'requisition_lines',
  'suppliers',
  'documents',
  'daily_site_reports',
  'variation_orders',
  'milestones',
  'user_profiles',
  'products',
  'chat_messages',
  'chat_channels',
] as const;

export type SoftDeleteTable = (typeof SOFT_DELETE_TABLES)[number];

export const TABLE_LABELS: Record<SoftDeleteTable, string> = {
  projects: 'Project',
  job_cost_sheets: 'Job Cost Sheet',
  job_cost_lines: 'Cost Sheet Line',
  budgets: 'Budget',
  budget_lines: 'Budget Line',
  requisitions: 'Requisition',
  requisition_lines: 'Requisition Line',
  suppliers: 'Supplier',
  documents: 'Document',
  daily_site_reports: 'Daily Site Report',
  variation_orders: 'Variation Order',
  milestones: 'Milestone',
  user_profiles: 'Staff Profile',
  products: 'Product',
  chat_messages: 'Chat Message',
  chat_channels: 'Chat Channel',
};

// Best-effort name column per table for display in Recently Deleted
export const NAME_COLUMN: Record<SoftDeleteTable, string> = {
  projects: 'name',
  job_cost_sheets: 'name',
  job_cost_lines: 'description',
  budgets: 'budget_number',
  budget_lines: 'description',
  requisitions: 'requisition_number',
  requisition_lines: 'description',
  suppliers: 'name',
  documents: 'name',
  daily_site_reports: 'dsr_number',
  variation_orders: 'vo_number',
  milestones: 'name',
  user_profiles: 'full_name',
  products: 'name',
  chat_messages: 'content',
  chat_channels: 'name',
};

export interface SoftDeleteOptions {
  table: SoftDeleteTable;
  id: string;
  /** Human-friendly name for activity log + toast */
  label?: string;
}

export async function softDelete({ table, id, label }: SoftDeleteOptions) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await (supabase as any)
    .from(table)
    .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
    .eq('id', id);
  if (error) return { error };
  await logActivity(table, 'deleted', id, { name: label });
  return { error: null };
}

export async function softRestore({ table, id, label }: SoftDeleteOptions) {
  const { error } = await (supabase as any)
    .from(table)
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', id);
  if (error) return { error };
  await logActivity(table, 'restored', id, { name: label });
  return { error: null };
}

export async function hardDelete({ table, id, label }: SoftDeleteOptions) {
  const { error } = await (supabase as any).from(table).delete().eq('id', id);
  if (error) return { error };
  await logActivity(table, 'permanently_deleted', id, { name: label });
  return { error: null };
}
