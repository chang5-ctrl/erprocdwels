import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/format';

interface BudgetLine {
  id: string;
  budget_id: string;
  category: string | null;
  description: string | null;
  planned_amount: number;
  actual_expenditure: number;
}

interface Props {
  budgetId: string;
  readOnly?: boolean;
  onChange?: () => void;
}

export function BudgetLinesTable({ budgetId, readOnly, onChange }: Props) {
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLines = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('budget_lines')
      .select('*')
      .eq('budget_id', budgetId)
      .order('created_at', { ascending: true });
    if (error) toast.error(error.message);
    setLines((data as any) || []);
    setLoading(false);
  }, [budgetId]);

  useEffect(() => {
    fetchLines();
  }, [fetchLines]);

  const addLine = async () => {
    const { data, error } = await supabase
      .from('budget_lines')
      .insert({ budget_id: budgetId, category: '', description: '', planned_amount: 0, actual_expenditure: 0 })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setLines(prev => [...prev, data as any]);
    onChange?.();
  };

  const updateField = (id: string, field: keyof BudgetLine, value: any) => {
    setLines(prev => prev.map(l => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const saveLine = async (line: BudgetLine, field: keyof BudgetLine) => {
    const value = line[field];
    const { error } = await supabase
      .from('budget_lines')
      .update({ [field]: value } as any)
      .eq('id', line.id);
    if (error) toast.error(error.message);
    else onChange?.();
  };

  const deleteLine = async (id: string) => {
    const { error } = await supabase.from('budget_lines').delete().eq('id', id);
    if (error) return toast.error(error.message);
    setLines(prev => prev.filter(l => l.id !== id));
    onChange?.();
    toast.success('Line deleted');
  };

  if (loading) return <div className="py-6 text-center text-muted-foreground">Loading lines...</div>;

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Planned (₦)</TableHead>
            <TableHead className="text-right">Actual</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
            <TableHead className="text-right">% Used</TableHead>
            {!readOnly && <TableHead className="w-12"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 && (
            <TableRow>
              <TableCell colSpan={readOnly ? 6 : 7} className="text-center py-8 text-muted-foreground">
                No budget lines yet.
              </TableCell>
            </TableRow>
          )}
          {lines.map(line => {
            const remaining = (line.planned_amount || 0) - (line.actual_expenditure || 0);
            const pct = line.planned_amount > 0 ? Math.round((line.actual_expenditure / line.planned_amount) * 100) : 0;
            return (
              <TableRow key={line.id}>
                <TableCell>
                  <Input
                    value={line.category || ''}
                    disabled={readOnly}
                    onChange={(e) => updateField(line.id, 'category', e.target.value)}
                    onBlur={() => saveLine(line, 'category')}
                    placeholder="e.g. Materials"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={line.description || ''}
                    disabled={readOnly}
                    onChange={(e) => updateField(line.id, 'description', e.target.value)}
                    onBlur={() => saveLine(line, 'description')}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    className="text-right"
                    value={line.planned_amount}
                    disabled={readOnly}
                    onChange={(e) => updateField(line.id, 'planned_amount', parseFloat(e.target.value) || 0)}
                    onBlur={() => saveLine(line, 'planned_amount')}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    className="text-right"
                    value={line.actual_expenditure}
                    disabled={readOnly}
                    onChange={(e) => updateField(line.id, 'actual_expenditure', parseFloat(e.target.value) || 0)}
                    onBlur={() => saveLine(line, 'actual_expenditure')}
                  />
                </TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(remaining)}</TableCell>
                <TableCell className={`text-right font-mono ${pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : ''}`}>
                  {pct}%
                </TableCell>
                {!readOnly && (
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteLine(line.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {!readOnly && (
        <Button variant="outline" onClick={addLine}>
          <Plus className="mr-2 h-4 w-4" /> Add Line
        </Button>
      )}
    </div>
  );
}

export default BudgetLinesTable;
