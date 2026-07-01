import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Plus, Flag, CheckCircle2, AlertTriangle, Clock, Circle, Edit2 } from 'lucide-react';
import { formatDate } from '@/lib/format';
import MilestoneDialog from './MilestoneDialog';
import RowDeleteButton from '@/components/RowDeleteButton';

const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-100 text-blue-800',
  delayed: 'bg-red-100 text-red-800',
  completed: 'bg-emerald-100 text-emerald-800',
  on_hold: 'bg-amber-100 text-amber-800',
};

export default function MilestoneList({ projectId, embedded = false }: { projectId?: string; embedded?: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'gantt'>('table');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [filters, setFilters] = useState({ project: projectId || 'all', status: 'all', responsible: 'all', from: '', to: '' });

  const load = async () => {
    setLoading(true);
    let q = (supabase as any).from('milestones').select('*, projects(name)').is('deleted_at', null).order('planned_start');
    if (projectId) q = q.eq('project_id', projectId);
    const { data } = await q;
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase.from('projects').select('id, name').order('name').then(({ data }) => setProjects(data ?? []));
    supabase.from('user_profiles').select('user_id, full_name').eq('is_active', true).then(({ data }) => setStaff(data ?? []));
    const ch = supabase.channel('ms-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestones' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId]);

  const filtered = useMemo(() => rows.filter(r =>
    (filters.project === 'all' || r.project_id === filters.project) &&
    (filters.status === 'all' || r.status === filters.status) &&
    (filters.responsible === 'all' || r.responsible_id === filters.responsible) &&
    (!filters.from || (r.planned_start ?? '') >= filters.from) &&
    (!filters.to || (r.planned_end ?? '') <= filters.to)
  ), [rows, filters]);

  const summary = useMemo(() => ({
    total: rows.length,
    completed: rows.filter(r => r.status === 'completed').length,
    in_progress: rows.filter(r => r.status === 'in_progress').length,
    delayed: rows.filter(r => r.status === 'delayed').length,
    not_started: rows.filter(r => r.status === 'not_started').length,
    avgPct: rows.length ? Math.round(rows.reduce((a, b) => a + Number(b.pct_complete || 0), 0) / rows.length) : 0,
    nextUpcoming: rows.filter(r => r.status !== 'completed').sort((a, b) => (a.planned_start ?? '').localeCompare(b.planned_start ?? ''))[0],
  }), [rows]);

  // Gantt bounds
  const gantt = useMemo(() => {
    const dates = filtered.flatMap(r => [r.planned_start, r.planned_end, r.actual_start, r.actual_end]).filter(Boolean).map(d => +new Date(d!));
    if (!dates.length) return null;
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    const span = Math.max(max - min, 86400000);
    const pos = (d?: string | null) => d ? ((+new Date(d) - min) / span) * 100 : 0;
    return { min, max, pos };
  }, [filtered]);

  return (
    <div className={embedded ? 'space-y-4' : 'p-4 md:p-6 space-y-4'}>
      {!embedded && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Flag className="h-6 w-6 text-primary" /><h1 className="text-2xl font-semibold">Milestone Tracker</h1></div>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="mr-1 h-4 w-4" />New Milestone</Button>
        </div>
      )}
      {embedded && (
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Milestones</h3>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="mr-1 h-3 w-3" />Add</Button>
        </div>
      )}

      {!embedded && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><Flag className="h-4 w-4" />Total</div><div className="mt-1 text-2xl font-semibold">{summary.total}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><CheckCircle2 className="h-4 w-4" />Completed</div><div className="mt-1 text-2xl font-semibold text-emerald-600">{summary.completed}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><Clock className="h-4 w-4" />In Progress</div><div className="mt-1 text-2xl font-semibold text-blue-600">{summary.in_progress}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><AlertTriangle className="h-4 w-4" />Delayed</div><div className="mt-1 text-2xl font-semibold text-destructive">{summary.delayed}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><Circle className="h-4 w-4" />Not Started</div><div className="mt-1 text-2xl font-semibold">{summary.not_started}</div></CardContent></Card>
        </div>
      )}

      {embedded && summary.total > 0 && (
        <Card><CardContent className="p-4 grid gap-2 sm:grid-cols-3 text-sm">
          <div><div className="text-xs text-muted-foreground">Overall %</div><div className="font-semibold">{summary.avgPct}%</div><Progress value={summary.avgPct} className="h-2 mt-1" /></div>
          <div><div className="text-xs text-muted-foreground">Delayed vs On Track</div><div>{summary.delayed} delayed / {summary.total - summary.delayed - summary.completed} on track</div></div>
          <div><div className="text-xs text-muted-foreground">Next Upcoming</div><div className="font-medium truncate">{summary.nextUpcoming?.name ?? '—'}</div></div>
        </CardContent></Card>
      )}

      {!embedded && (
        <Card><CardContent className="p-4 grid gap-2 sm:grid-cols-5">
          <Select value={filters.project} onValueChange={v => setFilters({ ...filters, project: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={v => setFilters({ ...filters, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.keys(STATUS_COLORS).map(s => <SelectItem key={s} value={s}>{s.replace(/_/g,' ')}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.responsible} onValueChange={v => setFilters({ ...filters, responsible: v })}>
            <SelectTrigger><SelectValue placeholder="Responsible" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staff.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} />
          <Input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} />
        </CardContent></Card>
      )}

      <Tabs value={view} onValueChange={v => setView(v as any)}>
        <TabsList><TabsTrigger value="table">Table</TabsTrigger><TabsTrigger value="gantt">Gantt</TabsTrigger></TabsList>
      </Tabs>

      {view === 'table' ? (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Milestone</TableHead><TableHead>Project</TableHead><TableHead>Type</TableHead>
              <TableHead>Planned</TableHead><TableHead>Actual</TableHead><TableHead>%</TableHead>
              <TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={8} className="text-center py-8">Loading…</TableCell></TableRow> :
               filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No milestones yet. Click "New Milestone" to break the project into trackable stages.</TableCell></TableRow> :
               filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.projects?.name ?? '—'}</TableCell>
                  <TableCell>{r.milestone_type ?? '—'}</TableCell>
                  <TableCell>{r.planned_start ? formatDate(r.planned_start) : '—'} → {r.planned_end ? formatDate(r.planned_end) : '—'}</TableCell>
                  <TableCell>{r.actual_start ? formatDate(r.actual_start) : '—'} → {r.actual_end ? formatDate(r.actual_end) : '—'}</TableCell>
                  <TableCell className="w-24"><Progress value={r.pct_complete ?? 0} className="h-2" /><div className="text-xs mt-1">{r.pct_complete ?? 0}%</div></TableCell>
                  <TableCell><Badge variant="secondary" className={STATUS_COLORS[r.status]}>{r.status.replace(/_/g,' ')}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setDialogOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                      <RowDeleteButton table="milestones" id={r.id} label={r.name} onDeleted={load} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-4 space-y-2">
          {!gantt || filtered.length === 0 ? <p className="text-sm text-muted-foreground">No dated milestones to plot.</p> :
            filtered.map(r => (
              <div key={r.id} className="grid grid-cols-[200px_1fr] gap-3 items-center">
                <div className="text-sm font-medium truncate">{r.name}</div>
                <div className="relative h-8 rounded bg-muted/50">
                  {r.planned_start && r.planned_end && (
                    <div className="absolute top-1 h-3 rounded bg-muted-foreground/30"
                         style={{ left: `${gantt.pos(r.planned_start)}%`, width: `${gantt.pos(r.planned_end) - gantt.pos(r.planned_start)}%` }} />
                  )}
                  {r.actual_start && (
                    <div className={`absolute bottom-1 h-3 rounded ${STATUS_COLORS[r.status]?.split(' ')[0] ?? 'bg-primary'}`}
                         style={{ left: `${gantt.pos(r.actual_start)}%`, width: `${Math.max(2, gantt.pos(r.actual_end || new Date().toISOString().slice(0,10)) - gantt.pos(r.actual_start))}%` }} />
                  )}
                </div>
              </div>
            ))
          }
          <div className="flex gap-3 text-xs text-muted-foreground pt-2 border-t">
            <span>▬ Planned</span><span>▬ Actual (colored by status)</span>
          </div>
        </CardContent></Card>
      )}

      <MilestoneDialog open={dialogOpen} onOpenChange={setDialogOpen} projectId={projectId} milestone={editing} onSaved={load} />
    </div>
  );
}
