import { supabase } from '@/integrations/supabase/client';

export interface HealthInputs {
  budgetTotal: number;
  budgetSpent: number;
  startDate?: string | null;
  expectedEndDate?: string | null;
  pendingRequisitions: number;
  pendingApprovals: number;
}

export interface HealthScore {
  score: number; // 0-100
  band: 'red' | 'amber' | 'green';
  label: string;
  color: string;
  parts: { budget: number; timeline: number; reqs: number; approvals: number };
}

export function computeHealthScore(i: HealthInputs): HealthScore {
  // Budget: 100 if <70% used, linear down to 0 at 120%
  const used = i.budgetTotal > 0 ? (i.budgetSpent / i.budgetTotal) * 100 : 0;
  const budget = used <= 70 ? 100 : Math.max(0, 100 - ((used - 70) * 2));

  // Timeline: compare actual elapsed % vs budget %
  let timeline = 100;
  if (i.startDate && i.expectedEndDate) {
    const start = new Date(i.startDate).getTime();
    const end = new Date(i.expectedEndDate).getTime();
    const now = Date.now();
    const span = Math.max(1, end - start);
    const elapsedPct = Math.min(100, Math.max(0, ((now - start) / span) * 100));
    // If we've burned much more budget than time elapsed, deduct points
    const drift = used - elapsedPct;
    timeline = drift <= 10 ? 100 : Math.max(0, 100 - drift * 2);
  }

  const reqs = Math.max(0, 100 - i.pendingRequisitions * 10);
  const approvals = Math.max(0, 100 - i.pendingApprovals * 12);

  const score = Math.round(budget * 0.4 + timeline * 0.3 + reqs * 0.15 + approvals * 0.15);

  let band: HealthScore['band'] = 'green';
  let color = 'text-emerald-600';
  let label = 'Healthy';
  if (score < 40) { band = 'red'; color = 'text-destructive'; label = 'At Risk'; }
  else if (score < 70) { band = 'amber'; color = 'text-amber-600'; label = 'Watch'; }

  return { score, band, label, color, parts: { budget: Math.round(budget), timeline: Math.round(timeline), reqs: Math.round(reqs), approvals: Math.round(approvals) } };
}

export async function loadProjectHealth(projectId: string): Promise<HealthScore | null> {
  const { data: p } = await supabase
    .from('projects')
    .select('budget_total, budget_spent, start_date, expected_end_date')
    .eq('id', projectId)
    .maybeSingle();
  if (!p) return null;
  const [{ count: reqCount }, { count: approvalCount }] = await Promise.all([
    supabase.from('requisitions').select('id', { count: 'exact', head: true }).eq('project_id', projectId).in('status', ['new', 'submitted', 'pending']).is('deleted_at', null),
    supabase.from('job_cost_sheets').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'pending').is('deleted_at', null),
  ]);
  return computeHealthScore({
    budgetTotal: Number(p.budget_total || 0),
    budgetSpent: Number(p.budget_spent || 0),
    startDate: p.start_date,
    expectedEndDate: p.expected_end_date,
    pendingRequisitions: reqCount || 0,
    pendingApprovals: approvalCount || 0,
  });
}
