import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Wallet, Calendar, User } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/format';
import { toast } from 'sonner';
import BudgetForm from './components/BudgetForm';

export default function BudgetList() {
  const { hasRole } = useAuth();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);

  const fetchBudgets = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('budgets')
      .select('*, projects(name), responsible: user_profiles!responsible_id (full_name)')
      .order('created_at', { ascending: false });
    setBudgets(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBudgets();
    const channel = supabase.channel('budgets-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, fetchBudgets)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const filteredBudgets = useMemo(() => {
    if (filterStatus === 'all') return budgets;
    return budgets.filter(b => b.status === filterStatus);
  }, [budgets, filterStatus]);

  const stats = useMemo(() => {
    const totalBudgeted = budgets.reduce((sum, b) => sum + (b.budget_lines?.reduce((s: number, l: any) => s + (l.planned_amount || 0), 0) || 0), 0);
    // Simplified stats
    return {
      totalBudgets: budgets.length,
      totalBudgeted,
      totalSpent: 0, // to be calculated properly later
    };
  }, [budgets]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Wallet className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Budgets</h1>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Budget
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Budgets</p>
            <p className="text-3xl font-bold">{stats.totalBudgets}</p>
          </CardContent>
        </Card>
        {/* Add more cards */}
      </div>

      <Table>
        {/* Table implementation */}
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
          {filteredBudgets.map(budget => (
            <TableRow key={budget.id}>
              <TableCell>
                <Link to={`/budgets/${budget.id}`} className="font-medium hover:underline">
                  {budget.budget_number}
                </Link>
              </TableCell>
              <TableCell>{budget.projects?.name}</TableCell>
              <TableCell>{formatDate(budget.date_from)}</TableCell>
              <TableCell>{formatDate(budget.date_to)}</TableCell>
              <TableCell>{budget.responsible?.full_name}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(0)}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(0)}</TableCell>
              <TableCell>
                <Badge variant={budget.status === 'approved' ? 'default' : budget.status === 'confirmed' ? 'secondary' : 'outline'}>
                  {budget.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <BudgetForm 
        open={showForm} 
        onClose={() => setShowForm(false)}
        onSuccess={() => { setShowForm(false); fetchBudgets(); }}
      />
    </div>
  );
}
