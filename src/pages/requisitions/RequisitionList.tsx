import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, ClipboardList, CheckCircle2, Clock } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activity';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  site_manager_confirmed: 'bg-amber-100 text-amber-800',
  procurement_review: 'bg-purple-100 text-purple-800',
  approved: 'bg-emerald-100 text-emerald-800',
  done: 'bg-muted text-muted-foreground',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  site_manager_confirmed: 'Site Manager Confirmed',
  procurement_review: 'Procurement Review',
  approved: 'Approved',
  done: 'Done',
};

const TYPES = ['Labour', 'Materials', 'Equipment', 'Overhead'];

export default function RequisitionList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [form, setForm] = useState<any>({
    project_id: '',
    requisition_type: 'Materials',
    employee_id: '',
    department: '',
    deadline: '',
    is_change_order: false,
    reason: '',
  });

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('requisitions')
      .select('*, projects(name), employee:user_profiles!requisitions_employee_id_fkey(full_name)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    // Fallback if FK alias name is unknown — fetch employee names separately
    if (data && data.length && !('employee' in data[0])) {
      const ids = Array.from(new Set(data.map((r: any) => r.employee_id).filter(Boolean)));
      const { data: prof } = await supabase.from('user_profiles').select('user_id, full_name').in('user_id', ids);
      const map: Record<string, string> = {};
      (prof ?? []).forEach((p: any) => { map[p.user_id] = p.full_name; });
      data.forEach((r: any) => { r.employee = { full_name: map[r.employee_id] }; });
    }
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase.from('projects').select('id, name').is('deleted_at', null).order('name').then(({ data }) => setProjects(data ?? []));
    supabase.from('user_profiles').select('user_id, full_name, job_title').is('deleted_at', null).order('full_name').then(({ data }) => setStaff(data ?? []));
    const ch = supabase.channel('req-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requisitions' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => rows.filter(r =>
    (filterStatus === 'all' || r.status === filterStatus) &&
    (filterProject === 'all' || r.project_id === filterProject) &&
    (filterType === 'all' || r.requisition_type === filterType)
  ), [rows, filterStatus, filterProject, filterType]);

  const summary = useMemo(() => ({
    total: rows.length,
    pending: rows.filter(r => !['approved', 'done'].includes(r.status)).length,
    approved: rows.filter(r => ['approved', 'done'].includes(r.status)).length,
  }), [rows]);

  const create = async () => {
    if (!form.project_id) return toast.error('Project is required');
    setCreating(true);
    const { count } = await supabase.from('requisitions').select('id', { count: 'exact', head: true });
    const nextNum = (count ?? 0) + 1;
    const req_number = `REQ/${String(nextNum).padStart(5, '0')}`;
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      requisition_number: req_number,
      project_id: form.project_id,
      requisition_type: form.requisition_type,
      employee_id: form.employee_id || null,
      department: form.department || null,
      deadline: form.deadline || null,
      is_change_order: !!form.is_change_order,
      reason: form.reason || null,
      status: 'new',
      created_by: user?.id ?? null,
    };
    const { data, error } = await (supabase as any).from('requisitions').insert(payload).select('id').single();
    setCreating(false);
    if (error) return toast.error(error.message);
    await logActivity('requisitions', 'created', data.id, { requisition_number: req_number });
    toast.success(`Requisition ${req_number} created`);
    setOpenNew(false);
    navigate(`/requisitions/${data.id}`);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Requisitions</h1>
        </div>
        <Button onClick={() => setOpenNew(true)}><Plus className="mr-1 h-4 w-4" />New Requisition</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><ClipboardList className="h-4 w-4" />Total</div><div className="mt-1 text-2xl font-semibold">{summary.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-4 w-4" />Pending</div><div className="mt-1 text-2xl font-semibold">{summary.pending}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4" />Approved</div><div className="mt-1 text-2xl font-semibold">{summary.approved}</div></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>REQ #</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No requisitions yet. Click "New Requisition" to start.</TableCell></TableRow>
            ) : filtered.map(r => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/requisitions/${r.id}`)}>
                <TableCell><Link to={`/requisitions/${r.id}`} className="font-medium text-primary hover:underline">{r.requisition_number}</Link></TableCell>
                <TableCell>{r.employee?.full_name || '—'}</TableCell>
                <TableCell>{r.projects?.name || '—'}</TableCell>
                <TableCell>{r.requisition_type || '—'}</TableCell>
                <TableCell>{r.deadline ? formatDate(r.deadline) : '—'}</TableCell>
                <TableCell><Badge variant="secondary" className={STATUS_COLORS[r.status] || ''}>{STATUS_LABELS[r.status] || r.status}</Badge></TableCell>
                <TableCell className="text-right"><Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/requisitions/${r.id}`); }}>Open</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Requisition</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Project</Label>
              <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Requisition Type</Label>
              <Select value={form.requisition_type} onValueChange={v => setForm({ ...form, requisition_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Employee</Label>
              <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>{staff.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}{s.job_title ? ` — ${s.job_title}` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Department</Label>
              <Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="e.g. Site Operations" />
            </div>
            <div className="grid gap-1.5">
              <Label>Deadline</Label>
              <Input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_change_order} onCheckedChange={(c) => setForm({ ...form, is_change_order: !!c })} />
              Is Change Order
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenNew(false)}>Cancel</Button>
            <Button onClick={create} disabled={creating}>{creating ? 'Creating…' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
