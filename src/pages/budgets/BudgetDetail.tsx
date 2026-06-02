import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/format';
import BudgetLinesTable from './components/BudgetLinesTable';

const STEPS = ['draft', 'confirmed', 'approved'] as const;

export default function BudgetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const [budget, setBudget] = useState<any>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [responsibleName, setResponsibleName] = useState<string>('');
  const [totals, setTotals] = useState({ planned: 0, spent: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchBudget = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase.from('budgets').select('*').eq('id', id).maybeSingle();
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    if (!data) {
      toast.error('Budget not found');
      navigate('/budgets');
      return;
    }
    setBudget(data);
    if (data.project_id) {
      const { data: p } = await supabase.from('projects').select('name').eq('id', data.project_id).maybeSingle();
      setProjectName(p?.name || '');
    }
    if (data.responsible_id) {
      const { data: u } = await supabase.from('user_profiles').select('full_name').eq('user_id', data.responsible_id).maybeSingle();
      setResponsibleName(u?.full_name || '');
    }
    setLoading(false);
  }, [id, navigate]);

  const fetchTotals = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('budget_lines').select('planned_amount, actual_expenditure').eq('budget_id', id);
    const planned = (data || []).reduce((s: number, l: any) => s + (Number(l.planned_amount) || 0), 0);
    const spent = (data || []).reduce((s: number, l: any) => s + (Number(l.actual_expenditure) || 0), 0);
    setTotals({ planned, spent });
  }, [id]);

  useEffect(() => {
    fetchBudget();
    fetchTotals();
  }, [fetchBudget, fetchTotals]);

  const handleStatusChange = async (newStatus: string) => {
    if (!budget) return;
    setSaving(true);
    const { error } = await supabase.from('budgets').update({ status: newStatus }).eq('id', id);
    if (error) toast.error(error.message);
    else {
      setBudget({ ...budget, status: newStatus });
      toast.success(`Budget ${newStatus}`);
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-12">Loading budget...</div>;
  if (!budget) return null;

  const remaining = totals.planned - totals.spent;
  const utilization = totals.planned > 0 ? Math.round((totals.spent / totals.planned) * 100) : 0;
  const utilColor = utilization >= 90 ? 'bg-red-500' : utilization >= 70 ? 'bg-amber-500' : 'bg-primary';
  const currentStep = STEPS.indexOf(budget.status as any);

  const readOnly = budget.status === 'approved';

  return (
    <div className="p-6">
      <Button variant="ghost" onClick={() => navigate('/budgets')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Budgets
      </Button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{budget.budget_number}</h1>
          <p className="text-muted-foreground">{projectName || 'No Project'}</p>
        </div>
        <Badge variant={budget.status === 'approved' ? 'default' : budget.status === 'confirmed' ? 'secondary' : 'outline'}>
          {budget.status?.toUpperCase()}
        </Badge>
      </div>

      {/* Header info */}
      <Card className="mb-6">
        <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><p className="text-muted-foreground">Project</p><p className="font-medium">{projectName || '—'}</p></div>
          <div><p className="text-muted-foreground">Analytic Account</p><p className="font-medium">{budget.analytic_account || '—'}</p></div>
          <div><p className="text-muted-foreground">Currency</p><p className="font-medium">{budget.currency || 'NGN'}</p></div>
          <div><p className="text-muted-foreground">Date From</p><p className="font-medium">{budget.date_from ? formatDate(budget.date_from) : '—'}</p></div>
          <div><p className="text-muted-foreground">Date To</p><p className="font-medium">{budget.date_to ? formatDate(budget.date_to) : '—'}</p></div>
          <div><p className="text-muted-foreground">Responsible</p><p className="font-medium">{responsibleName || '—'}</p></div>
        </CardContent>
      </Card>

      {/* Status flow */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${i <= currentStep ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground'}`}>
              {i < currentStep && <Check className="h-3 w-3" />}
              <span className="text-xs uppercase font-medium">{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`h-0.5 w-8 ${i < currentStep ? 'bg-primary' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-8">
        {budget.status === 'draft' && (
          <Button onClick={() => handleStatusChange('confirmed')} disabled={saving}>Confirm Budget</Button>
        )}
        {budget.status === 'confirmed' && hasRole('admin') && (
          <Button onClick={() => handleStatusChange('approved')} disabled={saving}>Approve Budget</Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Budgeted</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totals.planned)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Spent</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(totals.spent)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Remaining</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(remaining)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">% Utilised</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{utilization}%</div>
            <div className="h-2 bg-muted rounded mt-2 overflow-hidden">
              <div className={`h-full ${utilColor}`} style={{ width: `${Math.min(utilization, 100)}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Lines */}
      <Card>
        <CardHeader><CardTitle>Budget Lines</CardTitle></CardHeader>
        <CardContent>
          <BudgetLinesTable budgetId={id!} readOnly={readOnly} onChange={fetchTotals} />
        </CardContent>
      </Card>
    </div>
  );
}
