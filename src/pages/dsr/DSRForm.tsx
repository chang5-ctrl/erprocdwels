import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { capabilitiesFor } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activity';

const WEATHER = ['Sunny', 'Cloudy', 'Rainy', 'Stormy', 'Harmattan'];
const WORK_STATUS = ['Normal', 'Delayed', 'Suspended', 'Completed'];

type LineTable = 'dsr_workforce' | 'dsr_work' | 'dsr_materials' | 'dsr_equipment' | 'dsr_visitors' | 'dsr_issues';

function useLines(dsrId: string | undefined, table: LineTable) {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    if (!dsrId) return;
    const { data } = await (supabase as any).from(table).select('*').eq('dsr_id', dsrId).order('created_at');
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [dsrId]);
  const add = async (defaults: Record<string, any> = {}) => {
    if (!dsrId) return;
    const { data, error } = await (supabase as any).from(table).insert({ dsr_id: dsrId, ...defaults }).select().single();
    if (error) return toast.error(error.message);
    setRows([...rows, data]);
  };
  const update = async (id: string, patch: Record<string, any>) => {
    setRows(rows.map(r => r.id === id ? { ...r, ...patch } : r));
    await (supabase as any).from(table).update(patch).eq('id', id);
  };
  const remove = async (id: string) => {
    setRows(rows.filter(r => r.id !== id));
    await (supabase as any).from(table).delete().eq('id', id);
  };
  return { rows, add, update, remove };
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function Row({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="grid gap-2 items-center grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto]">
      <div className="grid gap-2 sm:grid-cols-6">{children}</div>
      <Button size="icon" variant="ghost" onClick={onRemove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
    </div>
  );
}

export default function DSRForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { roles, user } = useAuth();
  const caps = useMemo(() => capabilitiesFor(roles), [roles]);
  const isReviewer = roles.includes('admin') || roles.includes('project_manager');

  const [header, setHeader] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const wf = useLines(id, 'dsr_workforce');
  const wk = useLines(id, 'dsr_work');
  const mt = useLines(id, 'dsr_materials');
  const eq = useLines(id, 'dsr_equipment');
  const vs = useLines(id, 'dsr_visitors');
  const is = useLines(id, 'dsr_issues');

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [{ data: h }, { data: p }, { data: s }] = await Promise.all([
        (supabase as any).from('daily_site_reports').select('*').eq('id', id).maybeSingle(),
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('user_profiles').select('user_id, full_name').eq('is_active', true).order('full_name'),
      ]);
      if (!h) { toast.error('Report not found'); navigate('/dsr'); return; }
      setHeader(h);
      setProjects(p ?? []);
      setStaff(s ?? []);
      setLoading(false);
    })();
  }, [id]);

  const updateHeader = async (patch: Record<string, any>) => {
    setHeader({ ...header, ...patch });
    await (supabase as any).from('daily_site_reports').update(patch).eq('id', id);
  };

  const advance = async (status: string) => {
    const patch: any = { status };
    if (status === 'reviewed') { patch.reviewed_by = user?.id; patch.reviewed_at = new Date().toISOString(); }
    if (status === 'acknowledged') { patch.acknowledged_by = user?.id; patch.acknowledged_at = new Date().toISOString(); }
    await updateHeader(patch);
    await logActivity('daily_site_report', status, id!, { dsr_number: header.dsr_number });
    toast.success(`Report ${status}`);
  };

  if (loading || !header) return <div className="p-8 text-center">Loading…</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/dsr')}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{header.status}</Badge>
          {header.status === 'draft' && <Button size="sm" onClick={() => advance('submitted')}>Submit</Button>}
          {header.status === 'submitted' && isReviewer && <Button size="sm" onClick={() => advance('reviewed')}>Mark Reviewed</Button>}
          {header.status === 'reviewed' && isReviewer && <Button size="sm" onClick={() => advance('acknowledged')}>Acknowledge</Button>}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>{header.dsr_number}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <label className="text-xs text-muted-foreground">Project</label>
            <Select value={header.project_id ?? ''} onValueChange={v => updateHeader({ project_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Site Manager</label>
            <Select value={header.site_manager_id ?? ''} onValueChange={v => updateHeader({ site_manager_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>{staff.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Report Date</label>
            <Input type="date" value={header.report_date ?? ''} onChange={e => updateHeader({ report_date: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Weather</label>
            <Select value={header.weather ?? ''} onValueChange={v => updateHeader({ weather: v })}>
              <SelectTrigger><SelectValue placeholder="Weather" /></SelectTrigger>
              <SelectContent>{WEATHER.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Work Status</label>
            <Select value={header.work_status ?? ''} onValueChange={v => updateHeader({ work_status: v })}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>{WORK_STATUS.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <SectionCard title={`Workforce Present (${wf.rows.length})`}>
        {wf.rows.map(r => (
          <Row key={r.id} onRemove={() => wf.remove(r.id)}>
            <Input className="sm:col-span-2" placeholder="Worker name" defaultValue={r.worker_name ?? ''} onBlur={e => wf.update(r.id, { worker_name: e.target.value })} />
            <Input className="sm:col-span-1" placeholder="Trade/Role" defaultValue={r.trade ?? ''} onBlur={e => wf.update(r.id, { trade: e.target.value })} />
            <Input className="sm:col-span-1" type="number" placeholder="Hours" defaultValue={r.hours_worked ?? ''} onBlur={e => wf.update(r.id, { hours_worked: Number(e.target.value) })} />
            <Input className="sm:col-span-2" placeholder="Notes" defaultValue={r.notes ?? ''} onBlur={e => wf.update(r.id, { notes: e.target.value })} />
          </Row>
        ))}
        <Button size="sm" variant="outline" onClick={() => wf.add()}><Plus className="mr-1 h-3 w-3" />Add Worker</Button>
      </SectionCard>

      <SectionCard title="Work Carried Out">
        {wk.rows.map(r => (
          <Row key={r.id} onRemove={() => wk.remove(r.id)}>
            <Input className="sm:col-span-2" placeholder="Activity" defaultValue={r.activity ?? ''} onBlur={e => wk.update(r.id, { activity: e.target.value })} />
            <Input className="sm:col-span-1" placeholder="Location" defaultValue={r.location ?? ''} onBlur={e => wk.update(r.id, { location: e.target.value })} />
            <Input className="sm:col-span-1" type="number" placeholder="% Done" defaultValue={r.pct_complete ?? ''} onBlur={e => wk.update(r.id, { pct_complete: Number(e.target.value) })} />
            <Input className="sm:col-span-1" type="number" placeholder="Qty" defaultValue={r.quantity ?? ''} onBlur={e => wk.update(r.id, { quantity: Number(e.target.value) })} />
            <Input className="sm:col-span-1" placeholder="UoM" defaultValue={r.uom ?? ''} onBlur={e => wk.update(r.id, { uom: e.target.value })} />
          </Row>
        ))}
        <Button size="sm" variant="outline" onClick={() => wk.add()}><Plus className="mr-1 h-3 w-3" />Add Activity</Button>
      </SectionCard>

      <SectionCard title="Materials Used Today">
        {mt.rows.map(r => (
          <Row key={r.id} onRemove={() => mt.remove(r.id)}>
            <Input className="sm:col-span-2" placeholder="Material" defaultValue={r.material ?? ''} onBlur={e => mt.update(r.id, { material: e.target.value })} />
            <Input className="sm:col-span-1" type="number" placeholder="Used" defaultValue={r.quantity_used ?? ''} onBlur={e => mt.update(r.id, { quantity_used: Number(e.target.value) })} />
            <Input className="sm:col-span-1" placeholder="UoM" defaultValue={r.uom ?? ''} onBlur={e => mt.update(r.id, { uom: e.target.value })} />
            <Input className="sm:col-span-1" type="number" placeholder="Remaining" defaultValue={r.remaining_on_site ?? ''} onBlur={e => mt.update(r.id, { remaining_on_site: Number(e.target.value) })} />
            <Input className="sm:col-span-1" placeholder="Notes" defaultValue={r.notes ?? ''} onBlur={e => mt.update(r.id, { notes: e.target.value })} />
          </Row>
        ))}
        <Button size="sm" variant="outline" onClick={() => mt.add()}><Plus className="mr-1 h-3 w-3" />Add Material</Button>
      </SectionCard>

      <SectionCard title="Equipment on Site">
        {eq.rows.map(r => (
          <Row key={r.id} onRemove={() => eq.remove(r.id)}>
            <Input className="sm:col-span-2" placeholder="Equipment" defaultValue={r.equipment_name ?? ''} onBlur={e => eq.update(r.id, { equipment_name: e.target.value })} />
            <Select value={r.equipment_type ?? ''} onValueChange={v => eq.update(r.id, { equipment_type: v })}>
              <SelectTrigger className="sm:col-span-1"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent><SelectItem value="Owned">Owned</SelectItem><SelectItem value="Rented">Rented</SelectItem></SelectContent>
            </Select>
            <Input className="sm:col-span-1" placeholder="Operator" defaultValue={r.operator ?? ''} onBlur={e => eq.update(r.id, { operator: e.target.value })} />
            <Input className="sm:col-span-1" type="number" placeholder="Hours" defaultValue={r.hours_used ?? ''} onBlur={e => eq.update(r.id, { hours_used: Number(e.target.value) })} />
            <Input className="sm:col-span-1" placeholder="Condition" defaultValue={r.condition ?? ''} onBlur={e => eq.update(r.id, { condition: e.target.value })} />
          </Row>
        ))}
        <Button size="sm" variant="outline" onClick={() => eq.add()}><Plus className="mr-1 h-3 w-3" />Add Equipment</Button>
      </SectionCard>

      <SectionCard title="Visitors & Inspections">
        {vs.rows.map(r => (
          <Row key={r.id} onRemove={() => vs.remove(r.id)}>
            <Input className="sm:col-span-2" placeholder="Visitor" defaultValue={r.visitor_name ?? ''} onBlur={e => vs.update(r.id, { visitor_name: e.target.value })} />
            <Input className="sm:col-span-1" placeholder="Organisation" defaultValue={r.organisation ?? ''} onBlur={e => vs.update(r.id, { organisation: e.target.value })} />
            <Input className="sm:col-span-1" placeholder="Purpose" defaultValue={r.purpose ?? ''} onBlur={e => vs.update(r.id, { purpose: e.target.value })} />
            <Input className="sm:col-span-1" type="time" defaultValue={r.time_in ?? ''} onBlur={e => vs.update(r.id, { time_in: e.target.value })} />
            <Input className="sm:col-span-1" type="time" defaultValue={r.time_out ?? ''} onBlur={e => vs.update(r.id, { time_out: e.target.value })} />
          </Row>
        ))}
        <Button size="sm" variant="outline" onClick={() => vs.add()}><Plus className="mr-1 h-3 w-3" />Add Visitor</Button>
      </SectionCard>

      <SectionCard title="Issues & Observations">
        {is.rows.map(r => (
          <Row key={r.id} onRemove={() => is.remove(r.id)}>
            <Select value={r.issue_type ?? ''} onValueChange={v => is.update(r.id, { issue_type: v })}>
              <SelectTrigger className="sm:col-span-1"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>{['Safety','Quality','Delay','Material','Labour','Other'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Input className="sm:col-span-2" placeholder="Description" defaultValue={r.description ?? ''} onBlur={e => is.update(r.id, { description: e.target.value })} />
            <Select value={r.priority ?? ''} onValueChange={v => is.update(r.id, { priority: v })}>
              <SelectTrigger className="sm:col-span-1"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>{['High','Medium','Low'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
            <Input className="sm:col-span-1" placeholder="Responsible" defaultValue={r.responsible_person ?? ''} onBlur={e => is.update(r.id, { responsible_person: e.target.value })} />
            <Input className="sm:col-span-1" type="date" defaultValue={r.target_resolution_date ?? ''} onBlur={e => is.update(r.id, { target_resolution_date: e.target.value })} />
          </Row>
        ))}
        <Button size="sm" variant="outline" onClick={() => is.add()}><Plus className="mr-1 h-3 w-3" />Add Issue</Button>
      </SectionCard>

      <Card>
        <CardHeader><CardTitle className="text-base">Tomorrow's Plan</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">Planned Activities</label>
            <Textarea defaultValue={header.tomorrow_plan ?? ''} onBlur={e => updateHeader({ tomorrow_plan: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Materials Needed Tomorrow</label>
            <Textarea defaultValue={header.tomorrow_materials ?? ''} onBlur={e => updateHeader({ tomorrow_materials: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Expected Workforce Count</label>
            <Input type="number" defaultValue={header.tomorrow_workforce ?? ''} onBlur={e => updateHeader({ tomorrow_workforce: Number(e.target.value) })} />
            <label className="text-xs text-muted-foreground mt-2 block">Special Requirements</label>
            <Textarea defaultValue={header.tomorrow_special ?? ''} onBlur={e => updateHeader({ tomorrow_special: e.target.value })} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
