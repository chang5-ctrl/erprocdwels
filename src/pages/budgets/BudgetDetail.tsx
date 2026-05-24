import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Wallet, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/format';

export default function BudgetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const [budget, setBudget] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchBudget = async () => {
      try {
        const { data: budgetData, error } = await supabase
          .from('budgets')
          .select('*, project:projects(name), responsible:user_profiles(full_name)')
          .eq('id', id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            toast.error('Budget not found');
            navigate('/budgets');
            return;
          }
          throw error;
        }

        setBudget(budgetData);

        const { data: linesData } = await supabase
          .from('budget_lines')
          .select('*')
          .eq('budget_id', id);

        setLines(linesData || []);
      } catch (err: any) {
        console.error(err);
        toast.error('Failed to load budget');
      } finally {
        setLoading(false);
      }
    };

    fetchBudget();
  }, [id]);

  const totalBudgeted = lines.reduce((sum, line) => sum + (line.planned_amount || 0), 0);
  const totalSpent = lines.reduce((sum, line) => sum + (line.actual_expenditure || 0), 0);
  const remaining = totalBudgeted - totalSpent;
  const utilization = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

  const handleStatusChange = async (newStatus: string) => {
    if (!budget) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('budgets')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setBudget({ ...budget, status: newStatus });
      toast.success(`Budget ${newStatus}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12">Loading budget...</div>;
  }

  if (!budget) {
    return <div>Budget not found</div>;
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    confirmed: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800'
  };

  return (
    <div className="p-6">
      <Button variant="ghost" onClick={() => navigate('/budgets')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Budgets
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{budget.budget_number}</h1>
          <p className="text-muted-foreground">{budget.project?.name || 'No Project'}</p>
        </div>
        <Badge className={statusColors[budget.status as keyof typeof statusColors] || ''}>
          {budget.status?.toUpperCase()}
        </Badge>
      </div>

      {/* Status Actions */}
      <div className="flex gap-3 mb-8">
        {budget.status === 'draft' && (
          <Button onClick={() => handleStatusChange('confirmed')} disabled={saving}>
            Confirm Budget
          </Button>
        )}
        {budget.status === 'confirmed' && hasRole('admin') && (
          <Button onClick={() => handleStatusChange('approved')} disabled={saving}>
            Approve Budget
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Budgeted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(totalBudgeted)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{formatCurrency(totalSpent)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(remaining)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{utilization}%</div>
            <div className="h-2 bg-gray-200 rounded mt-2">
              <div 
                className={`h-2 rounded ${utilization >= 90 ? 'bg-red-500' : 'bg-green-500'}`} 
                style={{ width: `${utilization}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Lines */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Lines</CardTitle>
        </CardHeader>
        <CardContent>
          {/* BudgetLinesTable will be used here later */}
          <p className="text-muted-foreground py-8 text-center">Budget lines table component will be integrated here</p>
        </CardContent>
      </Card>
    </div>
  );
}
