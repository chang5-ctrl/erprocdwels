import { supabase } from '@/integrations/supabase/client';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface CreateNotificationInput {
  user_id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  severity?: NotificationSeverity;
  entity_type?: string;
  entity_id?: string;
}

export async function notify(input: CreateNotificationInput) {
  return supabase.from('notifications').insert([{ severity: 'info', ...input }]);
}

export async function notifyMany(inputs: CreateNotificationInput[]) {
  if (!inputs.length) return;
  return supabase.from('notifications').insert(
    inputs.map(i => ({ severity: 'info' as const, ...i })),
  );
}

/** Notify all users with a given role. */
export async function notifyRole(
  role: 'admin' | 'accountant' | 'project_manager' | 'site_manager' | 'procurement_officer',
  payload: Omit<CreateNotificationInput, 'user_id'>,
) {
  const { data } = await supabase.from('user_roles').select('user_id').eq('role', role);
  if (!data?.length) return;
  await notifyMany(data.map(r => ({ ...payload, user_id: r.user_id })));
}

/**
 * Smart budget alert — fires once when a project crosses 80% of its budget.
 * Safe to call after any cost-sheet / requisition write.
 */
export async function checkProjectBudgetAlert(projectId: string) {
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, budget_total, budget_spent')
    .eq('id', projectId)
    .maybeSingle();
  if (!project || !project.budget_total) return;
  const pct = (Number(project.budget_spent) / Number(project.budget_total)) * 100;
  if (pct < 80) return;

  // Skip if we've already alerted on this project in the last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('entity_type', 'project')
    .eq('entity_id', projectId)
    .eq('type', 'budget_alert')
    .gte('created_at', since)
    .limit(1);
  if (existing?.length) return;

  const severity: NotificationSeverity = pct >= 100 ? 'error' : 'warning';
  const title = pct >= 100
    ? `Budget exceeded: ${project.name}`
    : `Budget at ${pct.toFixed(0)}%: ${project.name}`;
  await notifyRole('admin', {
    type: 'budget_alert',
    title,
    body: `Project has consumed ${pct.toFixed(1)}% of its contract value.`,
    link: `/projects/${projectId}`,
    severity,
    entity_type: 'project',
    entity_id: projectId,
  });
  await notifyRole('accountant', {
    type: 'budget_alert',
    title,
    body: `Project has consumed ${pct.toFixed(1)}% of its contract value.`,
    link: `/projects/${projectId}`,
    severity,
    entity_type: 'project',
    entity_id: projectId,
  });
}
