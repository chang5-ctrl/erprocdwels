import { describe, it, expect } from 'vitest';
import { calculateBudgetSummary } from './budgetUtils';

describe('calculateBudgetSummary', () => {
  it('sums planned and actual values and computes the remaining balance', () => {
    expect(
      calculateBudgetSummary([
        { planned_amount: 120, actual_expenditure: 40 },
        { planned_amount: 80, actual_expenditure: 20 },
      ])
    ).toEqual({ total: 200, spent: 60, remaining: 140 });
  });
});
