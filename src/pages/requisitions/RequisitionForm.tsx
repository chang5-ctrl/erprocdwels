import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Save, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/lib/activity';
import { notifyRole } from '@/lib/notifications';
import { formatCurrency } from '@/lib/format';

const TYPES = ['Labour', 'Materials', 'Equipment', 'Overhead'];

const STATUS_FLOW = ['new', 'site_manager_confirmed', 'procurement_review', 'approved', 'done'] as const;
const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  site_manager_confirmed: 'Site Manager Confirmed',
  procurement_review: 'Procurement Review',
  approved: 'Approved',
  done: 'Done',
};
const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  site_manager_confirmed: 'bg-amber-100 text-amber-800',
  procurement_review: 'bg-purple-100 text-purple-800',
  approved: 'bg-emerald-100 text-emerald-800',
  done: 'bg-muted text-muted-foreground',
};

interface Line {
  id?: string;
  product: string;
  description?: string;
  quantity: number;
  uom: string;
  unit_cost: number;
}

export default function RequisitionForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const isAdmin = roles.includes('admin');
  const isSiteManager = roles.includes('site_manager');
  const isProcurement = roles.includes('procurement_officer');

  const [req, setReq] = useState<any>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: r }, { data: ls }] = await Promise.all([
      (supabase as any).from('requisitions').select('*, projects(name)').eq('id', id).maybeSingle(),
      (supabase as any).from('requisition_lines').select('*').eq('requisition_id', id).is('deleted_at', null).order('created_at'),
    ]);
    setReq(r);
    setLines((ls ?? []).map((l: any) => ({
      id: l.id, product: l.product || '', description: l.description || '',
      quantity: Number(l.quantity) || 0, uom: l.uom || '', unit_cost: Number(l.unit_cost) || 0,
    })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase.from('projects').select('id, name').is('deleted_at', null).order('name').then(({ data }) => setProjects(data ?? []));
    supabase.from('user_profiles').select('user_id, full_name, job_title').is('deleted_at', null).order('full_name').then(({ data }) => setStaff(data ?? []));
  }, [id]);

  const totalAmount = useMemo(() =>
    lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0),
  [lines]);

  const updateHeader = (patch: Partial<any>) => setReq((r: any) => ({ ...r, ...patch }));

  const addLine = () => setLines(ls => [...ls, { product: '', quantity: 1, uom: 'unit', unit_cost: 0 }]);
  const removeLine = async (idx: number) => {
    const l = lines[idx];
    if (l.id) await (supabase as any).from('requisition_lines').update({ deleted_at: new Date().toISOString() }).eq('id', l.id);
    setLines(ls => ls.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!req) return;
    setSaving(true);
    const { error: hErr } = await (supabase as any).from('requisitions').update({
      project_id: req.project_id,
      requisition_type: req.requisition_type,
      employee_id: req.employee_id,
      department: req.department,
      deadline: req.deadline,
      is_change_order: req.is_change_order,
      reason: req.reason,
    }).eq('id', req.id);
    if (hErr) { setSaving(false); return toast.error(hErr.message); }

    // Upsert lines: insert new, update existing
    for (const l of lines) {
      if (l.id) {
        await (supabase as any).from('requisition_lines').update({
          product: l.product, description: l.description, quantity: l.quantity, uom: l.uom, unit_cost: l.unit_cost,
        }).eq('id', l.id);
      } else {
        await (supabase as any).from('requisition_lines').insert({
          requisition_id: req.id, product: l.product, description: l.description,
          quantity: l.quantity, uom: l.uom, unit_cost: l.unit_cost,
        });
      }
    }
    await logActivity('requisitions', 'updated', req.id, { requisition_number: req.requisition_number });
    setSaving(false);
    toast.success('Requisition saved');
    load();
  };

  const transition = async (next: typeof STATUS_FLOW[number], actionLabel: string) => {
    if (!req) return;
    const { error } = await (supabase as any).from('requisitions').update({ status: next }).eq('id', req.id);
    if (error) return toast.error(error.message);
    await logActivity('requisitions', `status_${next}`, req.id, { from: req.status, to: next });
    toast.success(`${actionLabel} — status is now ${STATUS_LABELS[next]}`);
    // Notifications
    if (next === 'site_manager_confirmed') {
      await notifyRole('procurement_officer', {
        type: 'requisition_review',
        title: `Requisition ${req.requisition_number} awaiting procurement review`,
        link: `/requisitions/${req.id}`,
        entity_type: 'requisitions', entity_id: req.id,
      });
    } else if (next === 'procurement_review') {
      await notifyRole('procurement_officer', {
        type: 'requisition_review',
        title: `Requisition ${req.requisition_number} ready for procurement`,
        link: `/requisitions/${req.id}`,
        entity_type: 'requisitions', entity_id: req.id,
      });
    } else if (next === 'approved') {
      await notifyRole('admin', {
        type: 'requisition_approved',
        title: `Requisition ${req.requisition_number} approved`,
        link: `/requisitions/${req.id}`,
        entity_type: 'requisitions', entity_id: req.id, severity: 'success',
      });
    }
    load();
  };

  if (loading || !req) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const canConfirmSite = (isSiteManager || isAdmin) && req.status === 'new';
  const canSendProcurement = (isSiteManager || isAdmin) && req.status === 'site_manager_confirmed';
  const canApprove = (isProcurement || isAdmin) && (req.status === 'procurement_review' || (isAdmin && req.status !== 'approved' && req.status !== 'done'));
  const canMarkDone = isAdmin && req.status === 'approved';

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/requisitions')}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
          <h1 className="text-2xl font-semibold">{req.requisition_number}</h1>
          <Badge variant="secondary" className={STATUS_COLORS[req.status]}>{STATUS_LABELS[req.status]}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving} variant="outline"><Save className="h-4 w-4 mr-1" />{saving ? 'Saving…' : 'Save'}</Button>
          {canConfirmSite && <Button onClick={() => transition('site_manager_confirmed', 'Confirmed')}><CheckCircle2 className="h-4 w-4 mr-1" />Confirm</Button>}
          {canSendProcurement && <Button onClick={() => transition('procurement_review', 'Sent to Procurement')}>Send to Procurement</Button>}
          {canApprove && <Button onClick={() => transition('approved', 'Approved')}><CheckCircle2 className="h-4 w-4 mr-1" />Approve</Button>}
          {canMarkDone && <Button variant="secondary" onClick={() => transition('done', 'Marked Done')}>Mark Done</Button>}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Header</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Project</Label>
            <Select value={req.project_id || ''} onValueChange={v => updateHeader({ project_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Requisition Type</Label>
            <Select value={req.requisition_type || ''} onValueChange={v => updateHeader({ requisition_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Employee</Label>
            <Select value={req.employee_id || ''} onValueChange={v => updateHeader({ employee_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>{staff.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Department</Label>
            <Input value={req.department || ''} onChange={e => updateHeader({ department: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label>Deadline</Label>
            <Input type="date" value={req.deadline || ''} onChange={e => updateHeader({ deadline: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm mt-6">
            <Checkbox checked={!!req.is_change_order} onCheckedChange={c => updateHeader({ is_change_order: !!c })} />
            Is Change Order
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Requisition Lines</CardTitle>
          <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-4 w-4 mr-1" />Add Line</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Material / Item</TableHead>
              <TableHead className="w-28">Quantity</TableHead>
              <TableHead className="w-28">UoM</TableHead>
              <TableHead className="w-36">Unit Cost</TableHead>
              <TableHead className="w-36 text-right">Total</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No lines yet. Click "Add Line" to start.</TableCell></TableRow>
              ) : lines.map((l, idx) => {
                const total = (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0);
                return (
                  <TableRow key={idx}>
                    <TableCell><Input value={l.product} onChange={e => setLines(ls => ls.map((x, i) => i === idx ? { ...x, product: e.target.value } : x))} placeholder="Item name" /></TableCell>
                    <TableCell><Input type="number" value={l.quantity} onChange={e => setLines(ls => ls.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} /></TableCell>
                    <TableCell><Input value={l.uom} onChange={e => setLines(ls => ls.map((x, i) => i === idx ? { ...x, uom: e.target.value } : x))} /></TableCell>
                    <TableCell><Input type="number" value={l.unit_cost} onChange={e => setLines(ls => ls.map((x, i) => i === idx ? { ...x, unit_cost: Number(e.target.value) } : x))} /></TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(total)}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => removeLine(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex justify-end gap-6 px-4 py-3 border-t bg-muted/30">
            <div className="text-sm text-muted-foreground">Total Estimated Value</div>
            <div className="font-semibold">{formatCurrency(totalAmount)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Reason / Notes</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={4} value={req.reason || ''} onChange={e => updateHeader({ reason: e.target.value })} placeholder="Explain why this requisition is needed…" />
        </CardContent>
      </Card>
    </div>
  );
}
