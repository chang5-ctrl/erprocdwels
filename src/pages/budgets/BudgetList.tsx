import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Wallet } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/format';
import BudgetForm from './components/BudgetForm';

const STATUSES = ['all', 'draft', 'confirmed', 'approved'] as const;
type Status = typeof STATUSES[number];

export default function BudgetList() {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [linesByBudget, setLinesByBudget] = useState<Record<string, { planned: number; spent: number }>>({});
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [staff, setStaff] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<Status>('all');
  const [showForm, setShowForm] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: bs }, { data: ls }, { data: pjs }, { data: us }] = await Promise.all([
      supabase.from('budgets').select('*').order('created_at', { ascending: false }),
      supabase.from('budget_lines').select('budget_id, planned_amount, actual_expenditure'),
      supabase.from('projects').select('id, name'),
      supabase.from('user_profiles').select('user_id, full_name'),
    ]);
    setBudgets(bs || []);
    const agg: Record<string, { planned: number; spent: number }> = {};
    (ls || []).forEach((l: any) => {
      const k = l.budget_id;
      if (!agg[k]) agg[k] = { planned: 0, spent: 0 };
      agg[k].planned += Number(l.planned_amount) || 0;
      agg[k].spent += Number(l.actual_expenditure) || 0;
    });
    setLinesByBudget(agg);
    setProjects(Object.fromEntries((pjs || []).map((p: any) => [p.id, p.name])));
    setStaff(Object.fromEntries((us || []).map((u: any) => [u.user_id, u.full_name])));
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('budgets-list-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_lines' }, fetchAll)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredBudgets = useMemo(
    () => (filterStatus === 'all' ? budgets : budgets.filter(b => b.status === filterStatus)),
    [budgets, filterStatus]
  );

  const stats = useMemo(() => {
    let planned = 0;
    let spent = 0;
    budgets.forEach(b => {
      const agg = linesByBudget[b.id];
      if (agg) {
        planned += agg.planned;
        spent += agg.spent;
      }
    });
    return { count: budgets.length, planned, spent, remaining: planned - spent };
  }, [budgets, linesByBudget]);

  const statusVariant = (s: string): 'default' | 'secondary' | 'outline' =>
    s === 'approved' ? 'default' : s === 'confirmed' ? 'secondary' : 'outline';

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Wallet className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Budgets</h1>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Budget
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Budgets</p><p className="text-3xl font-bold">{stats.count}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Budgeted</p><p className="text-2xl font-bold">{formatCurrency(stats.planned)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Spent</p><p className="text-2xl font-bold text-red-600">{formatCurrency(stats.spent)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Remaining</p><p className="text-2xl font-bold text-green-600">{formatCurrency(stats.remaining)}</p></CardContent></Card>
      </div>

      <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as Status)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Budget #</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Responsible</TableHead>
                <TableHead className="text-right">Budgeted</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              )}
              {!loading && filteredBudgets.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No budgets found.</TableCell></TableRow>
              )}
              {filteredBudgets.map(budget => {
                const agg = linesByBudget[budget.id] || { planned: 0, spent: 0 };
                return (
                  <TableRow key={budget.id}>
                    <TableCell>
                      <Link to={`/budgets/${budget.id}`} className="font-medium hover:underline">
                        {budget.budget_number}
                      </Link>
                    </TableCell>
                    <TableCell>{projects[budget.project_id] || '—'}</TableCell>
                    <TableCell>{budget.date_from ? formatDate(budget.date_from) : '—'}</TableCell>
                    <TableCell>{budget.date_to ? formatDate(budget.date_to) : '—'}</TableCell>
                    <TableCell>{staff[budget.responsible_id] || '—'}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(agg.planned)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(agg.spent)}</TableCell>
                    <TableCell><Badge variant={statusVariant(budget.status)}>{budget.status}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BudgetForm open={showForm} onClose={() => setShowForm(false)} onSuccess={fetchAll} />
    </div>
  );
}
