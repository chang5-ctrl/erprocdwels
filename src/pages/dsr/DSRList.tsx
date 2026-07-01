import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ClipboardList } from 'lucide-react';
import { formatDate } from '@/lib/format';
import RowDeleteButton from '@/components/RowDeleteButton';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-blue-100 text-blue-800',
  reviewed: 'bg-amber-100 text-amber-800',
  acknowledged: 'bg-emerald-100 text-emerald-800',
};

export default function DSRList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('daily_site_reports')
      .select('*, projects(name)')
      .is('deleted_at', null)
      .order('report_date', { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase.from('projects').select('id, name').order('name').then(({ data }) => setProjects(data ?? []));
    const ch = supabase.channel('dsr-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_site_reports' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => rows.filter(r =>
    (projectFilter === 'all' || r.project_id === projectFilter) &&
    (statusFilter === 'all' || r.status === statusFilter) &&
    (!from || r.report_date >= from) &&
    (!to || r.report_date <= to)
  ), [rows, projectFilter, statusFilter, from, to]);

  const createNew = async () => {
    const { data, error } = await (supabase as any).from('daily_site_reports').insert({}).select('id').single();
    if (error) return alert(error.message);
    navigate(`/dsr/${data.id}`);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Daily Site Reports</h1>
        </div>
        <Button onClick={createNew}><Plus className="mr-1 h-4 w-4" />New Report</Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 md:grid-cols-4">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} placeholder="From" />
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} placeholder="To" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DSR ID</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Weather</TableHead>
                <TableHead>Workers</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={7} className="text-center py-8">Loading…</TableCell></TableRow> :
               filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No reports yet. Click "New Report" to create your first daily site report.</TableCell></TableRow> :
               filtered.map(r => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/dsr/${r.id}`)}>
                  <TableCell><Link to={`/dsr/${r.id}`} className="font-medium text-primary hover:underline">{r.dsr_number}</Link></TableCell>
                  <TableCell>{r.projects?.name || '—'}</TableCell>
                  <TableCell>{formatDate(r.report_date)}</TableCell>
                  <TableCell>{r.weather || '—'}</TableCell>
                  <TableCell>{r.tomorrow_workforce ?? '—'}</TableCell>
                  <TableCell><Badge variant="secondary" className={STATUS_COLORS[r.status]}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <RowDeleteButton table="daily_site_reports" id={r.id} label={r.dsr_number} onDeleted={load} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
