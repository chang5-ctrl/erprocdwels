import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileSpreadsheet } from 'lucide-react';
import { formatDate, formatCurrency, stateLabels, stateColors } from '@/lib/format';

interface SheetWithProject {
  id: string;
  name: string;
  state: string;
  total_planned_cost: number;
  currency: string;
  created_at: string;
  projects: { name: string } | null;
}

export default function JobCostSheetList() {
  const [sheets, setSheets] = useState<SheetWithProject[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('job_cost_sheets')
      .select('id, name, state, total_planned_cost, currency, created_at, projects(name)')
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

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Job Cost Sheets</h1>
        </div>
        <Link to="/job-cost-sheets/new">
          <Button><Plus className="mr-1 h-4 w-4" /> New Cost Sheet</Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : sheets.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <FileSpreadsheet className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No job cost sheets found. Create your first one.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sheet ID</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheets.map(s => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link to={`/job-cost-sheets/${s.id}`} className="font-mono font-medium text-primary hover:underline">
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell>{s.projects?.name || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={stateColors[s.state]}>
                      {stateLabels[s.state] || s.state}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(s.total_planned_cost)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(s.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
