import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activity';

const FLOW = ['draft', 'submitted', 'site_manager_review', 'project_manager_review', 'client_approval', 'admin_approved'];

export default function VariationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const [vo, setVo] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [previousTotal, setPreviousTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    const { data: v } = await (supabase as any).from('variation_orders').select('*').eq('id', id).maybeSingle();
    if (!v) { toast.error('Not found'); navigate('/variations'); return; }
    setVo(v);
    const { data: ln } = await (supabase as any).from('variation_order_lines').select('*').eq('vo_id', id).order('created_at');
    setLines(ln ?? []);
    if (v.project_id) {
      const { data: p } = await supabase.from('projects').select('*').eq('id', v.project_id).maybeSingle();
      setProject(p);
      const { data: prev } = await (supabase as any).from('variation_order_lines').select('amount, variation_orders!inner(project_id, status, id)').eq('variation_orders.project_id', v.project_id).eq('variation_orders.status', 'admin_approved');
      const sumPrev = (prev ?? []).filter((x: any) => x.variation_orders?.id !== id).reduce((a: number, b: any) => a + Number(b.amount || 0), 0);
      setPreviousTotal(sumPrev);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase.from('user_profiles').select('user_id, full_name').eq('is_active', true).order('full_name').then(({ data }) => setStaff(data ?? []));
  }, [id]);

  const update = async (patch: Record<string, any>) => {
    setVo({ ...vo, ...patch });
    await (supabase as any).from('variation_orders').update(patch).eq('id', id);
  };

  const addLine = async () => {
    const { data } = await (supabase as any).from('variation_order_lines').insert({ vo_id: id, quantity: 1, unit_rate: 0 }).select().single();
    if (data) setLines([...lines, data]);
  };
  const updateLine = async (lid: string, patch: Record<string, any>) => {
    setLines(lines.map(l => l.id === lid ? { ...l, ...patch, amount: (patch.quantity ?? l.quantity) * (patch.unit_rate ?? l.unit_rate) } : l));
    await (supabase as any).from('variation_order_lines').update(patch).eq('id', lid);
    load();
  };
  const removeLine = async (lid: string) => {
    setLines(lines.filter(l => l.id !== lid));
    await (supabase as any).from('variation_order_lines').delete().eq('id', lid);
  };

  const subtotal = useMemo(() => lines.reduce((a, b) => a + Number(b.amount || 0), 0), [lines]);
  const vat = subtotal * (Number(vo?.vat_pct || 0) / 100);
  const total = subtotal + vat;
  const original = Number(project?.budget_total || 0);
  const revised = original + previousTotal + total;

  const advance = async (next: string, field?: string) => {
    const patch: any = { status: next };
    if (field) { patch[`${field}_by`] = user?.id; patch[`${field}_at`] = new Date().toISOString(); }
    await update(patch);
    await logActivity('variation_order', next, id!, { vo_number: vo.vo_number });
    toast.success(`Moved to ${next.replace(/_/g, ' ')}`);
  };

  const reject = async () => {
    await update({ status: 'rejected' });
    await logActivity('variation_order', 'rejected', id!, { vo_number: vo.vo_number });
    toast.success('Rejected');
  };

  if (loading || !vo) return <div className="p-8 text-center">Loading…</div>;

  const isAdmin = roles.includes('admin');
  const isPM = roles.includes('project_manager') || isAdmin;
  const isSite = roles.includes('site_manager') || isAdmin;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/variations')}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{vo.status.replace(/_/g,' ')}</Badge>
          {vo.status === 'draft' && <Button size="sm" onClick={() => advance('submitted')}>Submit</Button>}
          {vo.status === 'submitted' && isSite && <Button size="sm" onClick={() => advance('site_manager_review', 'site_manager')}>Site Mgr Review</Button>}
          {vo.status === 'site_manager_review' && isPM && <Button size="sm" onClick={() => advance('project_manager_review', 'project_manager')}>PM Review</Button>}
          {vo.status === 'project_manager_review' && <Button size="sm" onClick={() => advance('client_approval', 'client')}>Send to Client</Button>}
          {vo.status === 'client_approval' && isAdmin && <Button size="sm" onClick={() => advance('admin_approved', 'admin')}>Admin Approve</Button>}
          {!['admin_approved','rejected','draft'].includes(vo.status) && <Button size="sm" variant="destructive" onClick={reject}>Reject</Button>}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>{vo.vo_number} — {vo.title}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div><label className="text-xs text-muted-foreground">Project</label><div className="font-medium">{project?.name || '—'}</div></div>
          <div><label className="text-xs text-muted-foreground">Original Contract</label><div className="font-medium">{formatCurrency(original)}</div></div>
          <div>
            <label className="text-xs text-muted-foreground">Requested By</label>
            <Select value={vo.requested_by ?? ''} onValueChange={v => update({ requested_by: v })}>
              <SelectTrigger><SelectValue placeholder="Staff" /></SelectTrigger>
              <SelectContent>{staff.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Date Requested</label>
            <Input type="date" value={vo.date_requested ?? ''} onChange={e => update({ date_requested: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Type</label>
            <Select value={vo.variation_type ?? ''} onValueChange={v => update({ variation_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['Addition','Omission','Substitution','Acceleration'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Priority</label>
            <Select value={vo.priority ?? ''} onValueChange={v => update({ priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['High','Medium','Low'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 sm:col-span-3">
            <Checkbox checked={vo.is_change_order ?? false} onCheckedChange={v => update({ is_change_order: !!v })} id="co" />
            <label htmlFor="co" className="text-sm">Is Change Order</label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div><label className="text-xs text-muted-foreground">Detailed Description</label><Textarea rows={4} defaultValue={vo.description ?? ''} onBlur={e => update({ description: e.target.value })} /></div>
          <div><label className="text-xs text-muted-foreground">Reason for Variation</label><Textarea defaultValue={vo.reason ?? ''} onBlur={e => update({ reason: e.target.value })} /></div>
          <div><label className="text-xs text-muted-foreground">Impact on Project</label><Textarea defaultValue={vo.impact ?? ''} onBlur={e => update({ impact: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Cost Breakdown</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {lines.map(l => (
            <div key={l.id} className="grid items-center gap-2 grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto]">
              <div className="grid gap-2 sm:grid-cols-7">
                <Input className="sm:col-span-2" placeholder="Item" defaultValue={l.item ?? ''} onBlur={e => updateLine(l.id, { item: e.target.value })} />
                <Input className="sm:col-span-2" placeholder="Description" defaultValue={l.description ?? ''} onBlur={e => updateLine(l.id, { description: e.target.value })} />
                <Input type="number" placeholder="Qty" defaultValue={l.quantity ?? 0} onBlur={e => updateLine(l.id, { quantity: Number(e.target.value) })} />
                <Input placeholder="UoM" defaultValue={l.uom ?? ''} onBlur={e => updateLine(l.id, { uom: e.target.value })} />
                <Input type="number" placeholder="Rate" defaultValue={l.unit_rate ?? 0} onBlur={e => updateLine(l.id, { unit_rate: Number(e.target.value) })} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium w-28 text-right">{formatCurrency(Number(l.amount || 0))}</span>
                <Button size="icon" variant="ghost" onClick={() => removeLine(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addLine}><Plus className="mr-1 h-3 w-3" />Add Line</Button>
          <div className="border-t pt-3 mt-3 grid gap-2 sm:grid-cols-3 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
            <div className="flex items-center gap-2"><span>VAT %</span><Input type="number" className="w-20" defaultValue={vo.vat_pct ?? 0} onBlur={e => update({ vat_pct: Number(e.target.value) })} /><span>= {formatCurrency(vat)}</span></div>
            <div className="flex justify-between font-semibold"><span>Total</span><span>{formatCurrency(total)}</span></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Time Impact</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div><label className="text-xs text-muted-foreground">Additional Days</label><Input type="number" defaultValue={vo.additional_days ?? 0} onBlur={e => update({ additional_days: Number(e.target.value) })} /></div>
          <div><label className="text-xs text-muted-foreground">Revised Completion Date</label><Input type="date" value={vo.revised_completion_date ?? ''} onChange={e => update({ revised_completion_date: e.target.value })} /></div>
          <div className="sm:col-span-3"><label className="text-xs text-muted-foreground">Justification</label><Textarea defaultValue={vo.justification ?? ''} onBlur={e => update({ justification: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Supporting References</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div><label className="text-xs text-muted-foreground">Drawing Reference Numbers</label><Input defaultValue={vo.drawing_refs ?? ''} onBlur={e => update({ drawing_refs: e.target.value })} /></div>
          <div><label className="text-xs text-muted-foreground">Specification References</label><Input defaultValue={vo.spec_refs ?? ''} onBlur={e => update({ spec_refs: e.target.value })} /></div>
          <p className="text-xs text-muted-foreground sm:col-span-2">Upload files in the Documents module and link to this project.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Approval Chain</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 text-sm">
          <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Site Manager</div><div>{vo.site_manager_at ? `✓ ${formatDate(vo.site_manager_at)}` : 'Pending'}</div></div>
          <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Project Manager</div><div>{vo.project_manager_at ? `✓ ${formatDate(vo.project_manager_at)}` : 'Pending'}</div></div>
          <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Client</div><div>{vo.client_at ? `✓ ${formatDate(vo.client_at)}` : 'Pending'}</div></div>
          <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Admin Final</div><div>{vo.admin_at ? `✓ ${formatDate(vo.admin_at)}` : 'Pending'}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Financial Summary</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 text-sm">
          <div className="flex justify-between"><span>Original contract value</span><span className="font-medium">{formatCurrency(original)}</span></div>
          <div className="flex justify-between"><span>Previously approved variations</span><span className="font-medium">{formatCurrency(previousTotal)}</span></div>
          <div className="flex justify-between"><span>This variation amount</span><span className="font-medium">{formatCurrency(total)}</span></div>
          <div className="flex justify-between text-base font-semibold"><span>Revised contract value</span><span>{formatCurrency(revised)}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}
