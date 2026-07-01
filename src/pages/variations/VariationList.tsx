import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileEdit, Wallet, CheckCircle2, Clock } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import RowDeleteButton from '@/components/RowDeleteButton';
import { FlexibleSelectInput } from '@/components/ui/flexible-select-input';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-blue-100 text-blue-800',
  site_manager_review: 'bg-amber-100 text-amber-800',
  project_manager_review: 'bg-amber-100 text-amber-800',
  client_approval: 'bg-amber-100 text-amber-800',
  admin_approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function VariationList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [lines, setLines] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState<any>({ title: '', project_id: '', variation_type: 'Addition', priority: 'Medium' });

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('variation_orders').select('*, projects(name, budget_total)').is('deleted_at', null).order('created_at', { ascending: false });
    setRows(data ?? []);
    const { data: ln } = await (supabase as any).from('variation_order_lines').select('vo_id, amount');
    const map: Record<string, number> = {};
    (ln ?? []).forEach((l: any) => { map[l.vo_id] = (map[l.vo_id] || 0) + Number(l.amount || 0); });
    setLines(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase.from('projects').select('id, name, budget_total').order('name').then(({ data }) => setProjects(data ?? []));
    const ch = supabase.channel('vo-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'variation_orders' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'variation_order_lines' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const summary = useMemo(() => {
    const total = rows.length;
    const value = Object.values(lines).reduce((a, b) => a + b, 0);
    const approved = rows.filter(r => r.status === 'admin_approved').length;
    const pending = rows.filter(r => !['admin_approved', 'rejected', 'draft'].includes(r.status)).length;
    return { total, value, approved, pending };
  }, [rows, lines]);

  const create = async () => {
    if (!form.title) return toast.error('Title required');
    const { data, error } = await (supabase as any).from('variation_orders').insert(form).select('id').single();
    if (error) return toast.error(error.message);
    toast.success('Variation order created');
    setOpenNew(false);
    navigate(`/variations/${data.id}`);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><FileEdit className="h-6 w-6 text-primary" /><h1 className="text-2xl font-semibold">Variation Orders</h1></div>
        <Button onClick={() => setOpenNew(true)}><Plus className="mr-1 h-4 w-4" />New Variation</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><FileEdit className="h-4 w-4" />Total Variations</div><div className="mt-1 text-2xl font-semibold">{summary.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><Wallet className="h-4 w-4" />Total Value</div><div className="mt-1 text-2xl font-semibold">{formatCurrency(summary.value)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><CheckCircle2 className="h-4 w-4" />Approved</div><div className="mt-1 text-2xl font-semibold">{summary.approved}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><Clock className="h-4 w-4" />Pending</div><div className="mt-1 text-2xl font-semibold">{summary.pending}</div></CardContent></Card>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>VO #</TableHead><TableHead>Project</TableHead><TableHead>Title</TableHead><TableHead>Type</TableHead>
            <TableHead>Amount</TableHead><TableHead>Revised Contract</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead>
            <TableHead className="w-12 text-right"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={9} className="text-center py-8">Loading…</TableCell></TableRow> :
             rows.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No variations yet. Click "New Variation" to track scope changes.</TableCell></TableRow> :
             rows.map(r => {
              const amt = lines[r.id] || 0;
              const total = (Number(r.projects?.budget_total) || 0) + amt;
              return (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/variations/${r.id}`)}>
                  <TableCell><Link to={`/variations/${r.id}`} className="font-medium text-primary hover:underline">{r.vo_number}</Link></TableCell>
                  <TableCell>{r.projects?.name || '—'}</TableCell>
                  <TableCell>{r.title}</TableCell>
                  <TableCell>{r.variation_type || '—'}</TableCell>
                  <TableCell>{formatCurrency(amt)}</TableCell>
                  <TableCell>{formatCurrency(total)}</TableCell>
                  <TableCell><Badge variant="secondary" className={STATUS_COLORS[r.status]}>{r.status.replace(/_/g, ' ')}</Badge></TableCell>
                  <TableCell>{formatDate(r.date_requested)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <RowDeleteButton table="variation_orders" id={r.id} label={r.vo_number} onDeleted={load} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Variation Order</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Input placeholder="Variation Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
              <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.variation_type} onValueChange={v => setForm({ ...form, variation_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['Addition','Omission','Substitution','Acceleration'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['High','Medium','Low'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
