import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, ClipboardList, ShoppingCart } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/format';

export default function ProcurementDashboard() {
  const [reqs, setReqs] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: r }, { data: s }, { data: l }] = await Promise.all([
        supabase.from('requisitions').select('id, requisition_number, status, requisition_date, requisition_type').order('created_at', { ascending: false }).limit(20),
        supabase.from('suppliers').select('id, name, is_active, created_at').order('created_at', { ascending: false }).limit(10),
        supabase.from('requisition_lines').select('total, created_at'),
      ]);
      setReqs(r ?? []);
      setSuppliers(s ?? []);
      setLines(l ?? []);
    };
    load();
    const ch = supabase.channel('proc-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requisitions' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const pending = reqs.filter(r => r.status === 'new' || r.status === 'confirmed');
  const totalPO = lines.reduce((s, l) => s + Number(l.total || 0), 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Procurement Dashboard</h1>
        <p className="text-sm text-muted-foreground">Approve requisitions and manage suppliers</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile icon={<ClipboardList className="h-4 w-4" />} label="Pending Requisitions" value={String(pending.length)} />
        <Tile icon={<Truck className="h-4 w-4" />} label="Active Suppliers" value={String(suppliers.filter(s => s.is_active).length)} />
        <Tile icon={<ShoppingCart className="h-4 w-4" />} label="Total PO Value" value={formatCurrency(totalPO)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Requisitions Awaiting Approval</CardTitle></CardHeader>
        <CardContent>
          {pending.length === 0 ? <p className="text-sm text-muted-foreground">Nothing pending.</p> : (
            <ul className="divide-y">
              {pending.map(r => (
                <li key={r.id} className="py-2 flex justify-between items-center text-sm">
                  <div>
                    <span className="font-mono font-medium">{r.requisition_number}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{r.requisition_type || '—'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="capitalize">{r.status}</Badge>
                    <span className="text-muted-foreground text-xs">{formatDate(r.requisition_date)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Supplier Activity</CardTitle></CardHeader>
        <CardContent>
          {suppliers.length === 0 ? <p className="text-sm text-muted-foreground">No suppliers yet.</p> : (
            <ul className="divide-y">
              {suppliers.map(s => (
                <li key={s.id} className="py-2 flex justify-between text-sm">
                  <Link to="/suppliers" className="text-primary hover:underline">{s.name}</Link>
                  <span className="text-muted-foreground text-xs">{formatDate(s.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center justify-between mb-2 text-muted-foreground">
        <span className="text-xs uppercase tracking-wide">{label}</span>{icon}
      </div>
      <p className="text-2xl font-bold truncate">{value}</p>
    </CardContent></Card>
  );
}
