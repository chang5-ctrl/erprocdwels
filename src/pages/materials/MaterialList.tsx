import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Package, Plus, Pencil, Trash2, Search, ArrowUpDown, AlertTriangle, History } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { softDelete } from '@/lib/soft-delete';
import { formatCurrency, formatDate } from '@/lib/format';

interface Material {
  id: string;
  name: string;
  category_id: string | null;
  uom: string;
  unit_cost: number;
  supplier_id: string | null;
  min_stock: number;
  current_stock: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
interface Category { id: string; name: string; sort_order: number }
interface Supplier { id: string; name: string }
interface Movement {
  id: string; movement_type: string; quantity: number; unit_cost: number | null;
  notes: string | null; created_at: string; reference_type: string | null;
}

const UOMS = ['bags', 'tonnes', 'meters', 'pieces', 'litres', 'kg', 'm²', 'm³', 'units'];
const emptyForm = {
  name: '', category_id: '', uom: 'pieces', unit_cost: 0,
  supplier_id: '', min_stock: 0, current_stock: 0, notes: '',
};

function stockStatus(current: number, min: number): { label: string; cls: string } {
  if (current <= 0) return { label: 'Out of Stock', cls: 'bg-destructive/10 text-destructive' };
  if (current <= min) return { label: 'Low Stock', cls: 'bg-amber-100 text-amber-800' };
  return { label: 'In Stock', cls: 'bg-emerald-100 text-emerald-800' };
}

export default function MaterialList() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Material[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Stock movement drawer
  const [moveFor, setMoveFor] = useState<Material | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [moveForm, setMoveForm] = useState({ movement_type: 'in', quantity: 0, unit_cost: 0, notes: '' });

  const load = async () => {
    setLoading(true);
    const [{ data: m }, { data: c }, { data: s }] = await Promise.all([
      supabase.from('materials').select('*').filter('deleted_at', 'is', null).order('name'),
      supabase.from('material_categories').select('*').order('sort_order'),
      supabase.from('suppliers').select('id, name').filter('deleted_at', 'is', null).order('name'),
    ]);
    setRows((m ?? []) as Material[]);
    setCats((c ?? []) as Category[]);
    setSuppliers((s ?? []) as Supplier[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const ch = supabase.channel('materials-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'material_movements' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => rows.filter(r => {
    if (catFilter !== 'all' && r.category_id !== catFilter) return false;
    if (stockFilter !== 'all') {
      const st = stockStatus(Number(r.current_stock), Number(r.min_stock)).label;
      if (stockFilter === 'low' && st !== 'Low Stock') return false;
      if (stockFilter === 'out' && st !== 'Out of Stock') return false;
      if (stockFilter === 'in' && st !== 'In Stock') return false;
    }
    if (search.trim() && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [rows, catFilter, stockFilter, search]);

  const summary = useMemo(() => {
    let total = rows.length, inS = 0, low = 0, out = 0, value = 0;
    rows.forEach(r => {
      const st = stockStatus(Number(r.current_stock), Number(r.min_stock)).label;
      if (st === 'In Stock') inS++; else if (st === 'Low Stock') low++; else out++;
      value += Number(r.current_stock) * Number(r.unit_cost);
    });
    return { total, inS, low, out, value };
  }, [rows]);

  const catName = (id: string | null) => cats.find(c => c.id === id)?.name ?? '—';
  const supName = (id: string | null) => suppliers.find(s => s.id === id)?.name ?? '—';

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (m: Material) => {
    setEditing(m);
    setForm({
      name: m.name, category_id: m.category_id ?? '', uom: m.uom,
      unit_cost: Number(m.unit_cost), supplier_id: m.supplier_id ?? '',
      min_stock: Number(m.min_stock), current_stock: Number(m.current_stock),
      notes: m.notes ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category_id: form.category_id || null,
      uom: form.uom,
      unit_cost: Number(form.unit_cost) || 0,
      supplier_id: form.supplier_id || null,
      min_stock: Number(form.min_stock) || 0,
      notes: form.notes || null,
    };
    let materialId = editing?.id;
    if (editing) {
      const { error } = await supabase.from('materials').update(payload).eq('id', editing.id);
      if (error) { setSaving(false); toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { data, error } = await supabase.from('materials').insert([{
        ...payload, current_stock: 0, created_by: user?.id,
      }]).select('id').single();
      if (error) { setSaving(false); toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
      materialId = data!.id;
      // Seed opening stock via a movement so trigger keeps things in sync
      if (Number(form.current_stock) > 0) {
        await supabase.from('material_movements').insert([{
          material_id: materialId, movement_type: 'in', quantity: Number(form.current_stock),
          unit_cost: Number(form.unit_cost) || null, notes: 'Opening balance', created_by: user?.id,
        }]);
      }
    }
    setSaving(false);
    toast({ title: editing ? 'Material updated' : 'Material added' });
    setOpen(false);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const m = rows.find(r => r.id === deleteId);
    const { error } = await softDelete({ table: 'materials', id: deleteId, label: m?.name });
    setDeleteId(null);
    if (error) return toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Moved to Recently Deleted' });
  };

  const openMovements = async (m: Material) => {
    setMoveFor(m);
    setMoveForm({ movement_type: 'in', quantity: 0, unit_cost: Number(m.unit_cost), notes: '' });
    const { data } = await supabase
      .from('material_movements')
      .select('*')
      .eq('material_id', m.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setMovements((data ?? []) as Movement[]);
  };

  const recordMovement = async () => {
    if (!moveFor || !moveForm.quantity) {
      toast({ title: 'Enter a quantity', variant: 'destructive' }); return;
    }
    const { error } = await supabase.from('material_movements').insert([{
      material_id: moveFor.id,
      movement_type: moveForm.movement_type,
      quantity: Number(moveForm.quantity),
      unit_cost: moveForm.unit_cost ? Number(moveForm.unit_cost) : null,
      notes: moveForm.notes || null,
      created_by: user?.id,
    }]);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Stock movement recorded' });
    setMoveForm({ ...moveForm, quantity: 0, notes: '' });
    openMovements(moveFor);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Materials</h1>
        </div>
        <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> New Material</Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Total Items" value={String(summary.total)} />
        <Tile label="In Stock" value={String(summary.inS)} accent="text-emerald-600" />
        <Tile label="Low Stock" value={String(summary.low)} accent="text-amber-600" />
        <Tile label="Out of Stock" value={String(summary.out)} accent="text-destructive" />
        <Tile label="Inventory Value" value={formatCurrency(summary.value)} />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search material…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stock</SelectItem>
            <SelectItem value="in">In Stock</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Package className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No materials match. Add your first construction material.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>UoM</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(m => {
                const st = stockStatus(Number(m.current_stock), Number(m.min_stock));
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{catName(m.category_id)}</TableCell>
                    <TableCell>{m.uom}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(Number(m.unit_cost))}</TableCell>
                    <TableCell className="text-right font-mono">{Number(m.current_stock)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{Number(m.min_stock)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={st.cls}>
                        {st.label === 'Low Stock' && <AlertTriangle className="mr-1 h-3 w-3" />}
                        {st.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{supName(m.supplier_id)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(m.updated_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" title="Stock movements" onClick={() => openMovements(m)}>
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Move to Recently Deleted" onClick={() => setDeleteId(m.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Edit Material' : 'New Material'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 grid gap-1.5">
              <Label>Material Name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dangote Cement 50kg" />
            </div>
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Unit of Measurement</Label>
              <Select value={form.uom} onValueChange={v => setForm({ ...form, uom: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UOMS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Unit Cost (₦)</Label>
              <Input type="number" value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: Number(e.target.value) })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Supplier</Label>
              <Select value={form.supplier_id} onValueChange={v => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Minimum Stock</Label>
              <Input type="number" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: Number(e.target.value) })} />
            </div>
            {!editing && (
              <div className="grid gap-1.5">
                <Label>Opening Stock</Label>
                <Input type="number" value={form.current_stock} onChange={e => setForm({ ...form, current_stock: Number(e.target.value) })} />
              </div>
            )}
            <div className="sm:col-span-2 grid gap-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            {editing && (
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Tip: use the <ArrowUpDown className="inline h-3 w-3" /> button on the row to record stock in/out movements.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Move material to Recently Deleted?"
        description="The item will be hidden from lists but can be restored within 30 days."
      />

      <Sheet open={!!moveFor} onOpenChange={(o) => !o && setMoveFor(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><History className="h-4 w-4" /> {moveFor?.name}</SheetTitle>
          </SheetHeader>
          {moveFor && (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Current stock</span><span className="font-mono font-semibold">{Number(moveFor.current_stock)} {moveFor.uom}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Minimum</span><span className="font-mono">{Number(moveFor.min_stock)} {moveFor.uom}</span></div>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">Record movement</p>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={moveForm.movement_type} onValueChange={v => setMoveForm({ ...moveForm, movement_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">Stock In</SelectItem>
                      <SelectItem value="out">Stock Out</SelectItem>
                      <SelectItem value="adjust">Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="Quantity" value={moveForm.quantity || ''} onChange={e => setMoveForm({ ...moveForm, quantity: Number(e.target.value) })} />
                </div>
                <Input type="number" placeholder="Unit cost (₦, optional)" value={moveForm.unit_cost || ''} onChange={e => setMoveForm({ ...moveForm, unit_cost: Number(e.target.value) })} />
                <Textarea rows={2} placeholder="Notes…" value={moveForm.notes} onChange={e => setMoveForm({ ...moveForm, notes: e.target.value })} />
                <Button size="sm" className="w-full" onClick={recordMovement}>Record</Button>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">History</p>
                {movements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No movements yet.</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {movements.map(mv => (
                      <li key={mv.id} className="p-2.5 text-sm">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className={
                            mv.movement_type === 'in' ? 'bg-emerald-100 text-emerald-800' :
                            mv.movement_type === 'out' ? 'bg-destructive/10 text-destructive' :
                            'bg-amber-100 text-amber-800'
                          }>
                            {mv.movement_type === 'in' ? '+' : mv.movement_type === 'out' ? '−' : '±'} {mv.quantity} {moveFor.uom}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{formatDate(mv.created_at)}</span>
                        </div>
                        {mv.notes && <p className="mt-1 text-xs text-muted-foreground">{mv.notes}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent ?? ''}`}>{value}</p>
    </div>
  );
}
