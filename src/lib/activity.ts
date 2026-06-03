import { supabase } from '@/integrations/supabase/client';

export async function logActivity(
  entity_type: string,
  action: string,
  entity_id?: string | null,
  details?: Record<string, unknown>,
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('activity_logs').insert([{
    user_id: user.id,
    entity_type,
    entity_id: entity_id ?? undefined,
    action,
    details: (details ?? null) as never,
  }]);
}

export const roleLabels: Record<string, string> = {
  admin: 'Admin',
  project_manager: 'Project Manager',
  site_manager: 'Site Manager',
  procurement_officer: 'Procurement Officer',
  accountant: 'Accountant',
};

export const roleColors: Record<string, string> = {
  admin: 'bg-primary/10 text-primary',
  project_manager: 'bg-purple-100 text-purple-800',
  site_manager: 'bg-blue-100 text-blue-800',
  procurement_officer: 'bg-amber-100 text-amber-800',
  accountant: 'bg-emerald-100 text-emerald-800',
};
