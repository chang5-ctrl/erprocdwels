export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(amount);
}

export const stateLabels: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  budget_validated: 'Budget Validated',
  approved: 'Approved',
  done: 'Done',
};

export const stateColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  confirmed: 'bg-blue-100 text-blue-800',
  budget_validated: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  done: 'bg-primary/10 text-primary',
};

export const statusLabels: Record<string, string> = {
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On Hold',
};

export const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-muted text-muted-foreground',
  on_hold: 'bg-amber-100 text-amber-800',
};
