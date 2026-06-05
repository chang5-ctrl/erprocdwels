import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileSpreadsheet, Wallet, Clock, Check, X } from 'lucide-react';
import { formatDate, formatCurrency, approvalLabels, approvalColors } from '@/lib/format';
import { logActivity } from '@/lib/activity';
import { capabilitiesFor } from '@/lib/permissions';
import { toast } from 'sonner';
import JobCostSheetDialog from './JobCostSheetDialog';

interface Sheet {
  id: string;
  name: string;
  status: string;
  category: string | null;
  amount: number;
  total_planned_cost: number;
  sheet_date: string | null;
  created_at: string;
  projects: { name: string } | null;
}

const CATEGORIES = ['all', 'materials', 'labour', 'equipment', 'overhead'];

export default function JobCostSheetList() {
  const { roles } = useAuth();
  const caps = useMemo(() => capabilitiesFor(roles), [roles]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('job_cost_sheets')
      .select('id, name, status, category, amount, total_planned_cost, sheet_date, created_at, projects(name)')
      .filter('deleted_at', 'is', null)
      .order('created_at', { ascending: false });
    setSheets((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetch();
    const ch = supabase.channel('jcs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_cost_sheets' }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(
    () => category === 'all' ? sheets : sheets.filter(s => s.category === category),
    [sheets, category],
  );

  const totals = useMemo(() => {
    const total = sheets.length;
    const expenditure = sheets.reduce((s, x) => s + Number(x.amount || x.total_planned_cost || 0), 0);
    const pending = sheets.filter(s => s.status === 'pending').length;
    return { total, expenditure, pending };
  }, [sheets]);

  const decide = async (s: Sheet, status: 'approved' | 'rejected') => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('job_cost_sheets').update({
      status,
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    }).eq('id', s.id);
    if (error) { toast.error(error.message); return; }
    await logActivity('job_cost_sheet', status, s.id, { name: s.name });
    toast.success(`Cost sheet ${status}`);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Job Cost Sheets</h1>
        </div>
        {caps.createCostSheet && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New Cost Sheet
          </Button>
        )}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard icon={<FileSpreadsheet className="h-5 w-5" />} label="Total Sheets" value={totals.total.toString()} glow="bg-primary/30" />
        <StatCard icon={<Wallet className="h-5 w-5" />} label="Total Expenditure" value={formatCurrency(totals.expenditure)} glow="bg-accent/40" />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Pending Approval" value={totals.pending.toString()} glow="bg-amber-500/30" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map(c => (
          <Button key={c} size="sm" variant={category === c ? 'default' : 'outline'} onClick={() => setCategory(c)}>
            {c === 'all' ? 'All' : c[0].toUpperCase() + c.slice(1)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <FileSpreadsheet className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No cost sheets in this category yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sheet ID</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Date</TableHead>
                {caps.approveCostSheet && <TableHead className="w-40 text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link to={`/job-cost-sheets/${s.id}`} className="font-mono font-medium text-primary hover:underline">
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell>{s.projects?.name || '—'}</TableCell>
                  <TableCell className="capitalize">{s.category || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={approvalColors[s.status] || ''}>
                      {approvalLabels[s.status] || s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(Number(s.amount || s.total_planned_cost || 0))}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(s.sheet_date || s.created_at)}</TableCell>
                  {caps.approveCostSheet && (
                    <TableCell className="text-right">
                      {s.status === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-emerald-700" onClick={() => decide(s, 'approved')}>
                            <Check className="mr-1 h-3 w-3" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-destructive" onClick={() => decide(s, 'rejected')}>
                            <X className="mr-1 h-3 w-3" /> Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <JobCostSheetDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={fetch} />
    </div>
  );
}

function StatCard({ icon, label, value, glow }: { icon: React.ReactNode; label: string; value: string; glow: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl ${glow}`} />
      <CardContent className="relative pt-5">
        <div className="mb-2 flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}
