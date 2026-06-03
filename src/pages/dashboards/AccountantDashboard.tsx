import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, FileSpreadsheet, Clock, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function AccountantDashboard() {
  const [sheets, setSheets] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: s }, { data: p }, { data: b }, { data: l }] = await Promise.all([
        supabase.from('job_cost_sheets').select('id, name, amount, status, sheet_date, created_at, projects(name)').order('created_at', { ascending: false }),
        supabase.from('job_cost_sheets').select('id, name, amount, sheet_date, projects(name)').eq('status', 'pending').order('created_at', { ascending: false }).limit(10),
        supabase.from('budgets').select('id, budget_number, status'),
        supabase.from('budget_lines').select('planned_amount, actual_expenditure'),
      ]);
      setSheets(s ?? []);
      setPending(p ?? []);
      setBudgets(b ?? []);
      setLines(l ?? []);
    };
    load();
    const ch = supabase.channel('acct-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_cost_sheets' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const totalExpenditure = useMemo(
    () => sheets.filter(s => s.status === 'approved').reduce((sum, x) => sum + Number(x.amount || 0), 0),
    [sheets],
  );
  const totalPlanned = useMemo(() => lines.reduce((s, l) => s + Number(l.planned_amount || 0), 0), [lines]);
  const totalActual = useMemo(() => lines.reduce((s, l) => s + Number(l.actual_expenditure || 0), 0), [lines]);

  const monthly = useMemo(() => {
    const now = new Date();
    const labels: string[] = [];
    const data: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      labels.push(d.toLocaleDateString('en-GB', { month: 'short' }));
      const sum = sheets
        .filter(s => s.status === 'approved' && new Date(s.created_at) >= d && new Date(s.created_at) < next)
        .reduce((a, x) => a + Number(x.amount || 0), 0);
      data.push(sum);
    }
    return { labels, data };
  }, [sheets]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Accountant Dashboard</h1>
        <p className="text-sm text-muted-foreground">Approve cost sheets and monitor financials</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={<Wallet className="h-4 w-4" />} label="Total Expenditure" value={formatCurrency(totalExpenditure)} />
        <Tile icon={<Clock className="h-4 w-4" />} label="Pending Approvals" value={String(pending.length)} />
        <Tile icon={<CheckCircle2 className="h-4 w-4" />} label="Budgets" value={String(budgets.length)} />
        <Tile icon={<FileSpreadsheet className="h-4 w-4" />} label="Total Cost Sheets" value={String(sheets.length)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Approved Expenditure — Last 6 Months</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <Bar
              data={{
                labels: monthly.labels,
                datasets: [{ label: 'Expenditure', data: monthly.data, backgroundColor: 'hsl(270 60% 55%)', borderRadius: 4 }],
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: 'hsl(var(--foreground))' } } },
                scales: {
                  x: { ticks: { color: 'hsl(var(--muted-foreground))' }, grid: { color: 'hsl(var(--border))' } },
                  y: { ticks: { color: 'hsl(var(--muted-foreground))', callback: (v) => `₦${Number(v) / 1000}k` }, grid: { color: 'hsl(var(--border))' } },
                },
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Pending Cost Sheets</CardTitle></CardHeader>
          <CardContent>
            {pending.length === 0 ? <p className="text-sm text-muted-foreground">Nothing pending.</p> : (
              <ul className="divide-y">
                {pending.map(s => (
                  <li key={s.id} className="py-2 flex justify-between text-sm">
                    <Link to={`/job-cost-sheets/${s.id}`} className="text-primary hover:underline font-mono">{s.name}</Link>
                    <span className="text-muted-foreground">{formatCurrency(Number(s.amount || 0))}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Budget vs Actual</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Planned</span><span className="font-mono">{formatCurrency(totalPlanned)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Actual</span><span className="font-mono">{formatCurrency(totalActual)}</span></div>
            <div className="flex justify-between border-t pt-2"><span className="font-medium">Remaining</span><span className="font-mono font-bold">{formatCurrency(totalPlanned - totalActual)}</span></div>
          </CardContent>
        </Card>
      </div>
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
