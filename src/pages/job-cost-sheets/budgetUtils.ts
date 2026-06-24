export interface BudgetSummaryLine {
  planned_amount?: number | null;
  actual_expenditure?: number | null;
}

export function calculateBudgetSummary(lines: BudgetSummaryLine[]) {
  const total = lines.reduce((sum, line) => sum + Number(line.planned_amount || 0), 0);
  const spent = lines.reduce((sum, line) => sum + Number(line.actual_expenditure || 0), 0);

  return {
    total,
    spent,
    remaining: total - spent,
  };
}
