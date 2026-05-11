import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Building2,
  Wallet,
  CheckCircle2,
  Users,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
  Truck,
  FilePlus2,
  UserPlus,
  LogIn,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title);

interface ActivityRow {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  user_id: string | null;
  details: Record<string, unknown> | null;
}

interface StatCard {
  label: string;
  value: string;
  change: number | null;
  icon: typeof Building2;
  glow: string;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const ENTITY_ICONS: Record<string, typeof FileSpreadsheet> = {
  project: Building2,
  job_cost_sheet: FileSpreadsheet,
  supplier: Truck,
  document: FilePlus2,
  user: UserPlus,
  auth: LogIn,
};

export default function AdminDashboard() {
  const { hasRole, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatCard[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [monthly, setMonthly] = useState<{ labels: string[]; revenue: number[]; expenditure: number[] }>({
    labels: [],
    revenue: [],
    expenditure: [],
  });
  const [statusBreakdown, setStatusBreakdown] = useState<Record<string, number>>({
    active: 0,
    completed: 0,
    handover: 0,
    on_hold: 0,
  });

  useEffect(() => {
    if (authLoading || !hasRole('admin')) return;

    const load = async () => {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const [projectsAll, sheetsAll, profilesAll, activityRes, linesRes] = await Promise.all([
        supabase.from('projects').select('id,status,created_at'),
        supabase.from('job_cost_sheets').select('id,state,total_planned_cost,created_at'),
        supabase.from('user_profiles').select('id,is_active,created_at,user_id,full_name'),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('job_cost_lines').select('actual_purchased_cost,created_at'),
      ]);

      const projects = projectsAll.data ?? [];
      const sheets = sheetsAll.data ?? [];
      const profiles = profilesAll.data ?? [];
      const lines = linesRes.data ?? [];

      // Status breakdown
      const breakdown: Record<string, number> = { active: 0, completed: 0, handover: 0, on_hold: 0 };
      projects.forEach(p => {
        const k = (p.status ?? 'active') as string;
        breakdown[k] = (breakdown[k] ?? 0) + 1;
      });
      setStatusBreakdown(breakdown);

      // Helpers for percentage change (this month vs last month, count-based)
      const inRange = <T extends { created_at: string }>(rows: T[], start: string, end?: string) =>
        rows.filter(r => r.created_at >= start && (!end || r.created_at < end)).length;
      const pctChange = (curr: number, prev: number): number | null => {
        if (prev === 0) return curr > 0 ? 100 : null;
        return ((curr - prev) / prev) * 100;
      };

      const activeProjects = projects.filter(p => p.status === 'active').length;
      const completedProjects = projects.filter(p => p.status === 'completed').length;
      const activeStaff = profiles.filter(p => p.is_active).length;
      const totalContract = sheets.reduce((s, r) => s + Number(r.total_planned_cost ?? 0), 0);

      const projChangeAct = pctChange(
        inRange(projects.filter(p => p.status === 'active'), thisMonthStart),
        inRange(projects.filter(p => p.status === 'active'), lastMonthStart, thisMonthStart),
      );
      const sheetCurr = sheets.filter(s => s.created_at >= thisMonthStart).reduce((s, r) => s + Number(r.total_planned_cost ?? 0), 0);
      const sheetPrev = sheets.filter(s => s.created_at >= lastMonthStart && s.created_at < thisMonthStart).reduce((s, r) => s + Number(r.total_planned_cost ?? 0), 0);
      const contractChange = pctChange(sheetCurr, sheetPrev);
      const completedChange = pctChange(
        inRange(projects.filter(p => p.status === 'completed'), thisMonthStart),
        inRange(projects.filter(p => p.status === 'completed'), lastMonthStart, thisMonthStart),
      );
      const staffChange = pctChange(
        inRange(profiles, thisMonthStart),
        inRange(profiles, lastMonthStart, thisMonthStart),
      );

      setStats([
        { label: 'Active Projects', value: String(activeProjects), change: projChangeAct, icon: Building2, glow: 'bg-primary/30' },
        { label: 'Total Contract Value', value: formatCurrency(totalContract), change: contractChange, icon: Wallet, glow: 'bg-accent/40' },
        { label: 'Completed Projects', value: String(completedProjects), change: completedChange, icon: CheckCircle2, glow: 'bg-emerald-500/30' },
        { label: 'Active Staff', value: String(activeStaff), change: staffChange, icon: Users, glow: 'bg-blue-500/30' },
      ]);

      // 6-month bar chart
      const labels: string[] = [];
      const revenueArr: number[] = [];
      const expArr: number[] = [];
      for (let i = 0; i < 6; i++) {
        const d = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + i, 1);
        const next = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + i + 1, 1);
        labels.push(d.toLocaleDateString('en-GB', { month: 'short' }));
        const rev = sheets
          .filter(s => (s.state === 'done' || s.state === 'approved') && new Date(s.created_at) >= d && new Date(s.created_at) < next)
          .reduce((sum, r) => sum + Number(r.total_planned_cost ?? 0), 0);
        const exp = lines
          .filter(l => new Date(l.created_at) >= d && new Date(l.created_at) < next)
          .reduce((sum, r) => sum + Number(r.actual_purchased_cost ?? 0), 0);
        revenueArr.push(rev);
        expArr.push(exp);
      }
      setMonthly({ labels, revenue: revenueArr, expenditure: expArr });

      // Activity + user names
      const acts = (activityRes.data ?? []) as ActivityRow[];
      setActivity(acts);
      const ids = Array.from(new Set(acts.map(a => a.user_id).filter(Boolean))) as string[];
      const nameMap: Record<string, string> = {};
      profiles.forEach(p => { if (p.user_id) nameMap[p.user_id] = p.full_name ?? 'User'; });
      ids.forEach(id => { if (!nameMap[id]) nameMap[id] = 'User'; });
      setUserNames(nameMap);

      setLoading(false);
    };

    load();
    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authLoading, hasRole]);

  const surface = 'hsl(var(--card))';
  const fg = 'hsl(var(--foreground))';
  const muted = 'hsl(var(--muted-foreground))';
  const border = 'hsl(var(--border))';
  const primary = 'hsl(270 60% 55%)';
  const gold = 'hsl(42 85% 55%)';

  const barData = useMemo(() => ({
    labels: monthly.labels,
    datasets: [
      { label: 'Revenue', data: monthly.revenue, backgroundColor: primary, borderRadius: 4 },
      { label: 'Expenditure', data: monthly.expenditure, backgroundColor: gold, borderRadius: 4 },
    ],
  }), [monthly]);

  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: fg, font: { family: 'DM Sans, sans-serif' } } },
      tooltip: { callbacks: { label: (c: { dataset: { label?: string }; parsed: { y: number } }) => `${c.dataset.label}: ${formatCurrency(c.parsed.y)}` } },
    },
    scales: {
      x: { grid: { color: border }, ticks: { color: muted, font: { family: 'DM Sans, sans-serif' } } },
      y: { grid: { color: border }, ticks: { color: muted, font: { family: 'DM Sans, sans-serif' }, callback: (v: number | string) => `₦${Number(v) / 1000}k` } },
    },
  }), [fg, muted, border]);

  const doughnutData = useMemo(() => ({
    labels: ['Active', 'Completed', 'Handover', 'On Hold'],
    datasets: [{
      data: [statusBreakdown.active, statusBreakdown.completed, statusBreakdown.handover, statusBreakdown.on_hold],
      backgroundColor: [primary, 'hsl(142 71% 45%)', gold, 'hsl(217 91% 60%)'],
      borderColor: surface,
      borderWidth: 2,
    }],
  }), [statusBreakdown, surface]);

  const doughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { position: 'bottom' as const, labels: { color: fg, font: { family: 'DM Sans, sans-serif' }, padding: 12, boxWidth: 12 } },
    },
  }), [fg]);

  if (authLoading) return null;
  if (!hasRole('admin')) return <Navigate to="/projects" replace />;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of projects, finances and team activity</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(c => (
          <Card key={c.label} className="relative overflow-hidden">
            <div className={`pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full blur-3xl ${c.glow}`} />
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold truncate">{loading ? '—' : c.value}</p>
              {c.change !== null && !loading && (
                <div className={`mt-2 flex items-center gap-1 text-xs ${c.change >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  {c.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  <span className="font-medium">{Math.abs(c.change).toFixed(1)}%</span>
                  <span className="text-muted-foreground">vs last month</span>
                </div>
              )}
              {c.change === null && !loading && (
                <p className="mt-2 text-xs text-muted-foreground">No prior data</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Revenue vs Expenditure (last 6 months)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              {!loading && <Bar data={barData} options={barOptions} />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Project Status</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              {!loading && <Doughnut data={doughnutData} options={doughnutOptions} />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Recent Activity</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y">
              {activity.map(a => {
                const Icon = ENTITY_ICONS[a.entity_type] ?? Activity;
                const who = a.user_id ? (userNames[a.user_id] ?? 'User') : 'System';
                return (
                  <li key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="rounded-md bg-primary/10 p-2 mt-0.5">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium capitalize">{a.action}</span>{' '}
                        <span className="text-muted-foreground">on</span>{' '}
                        <span className="capitalize">{a.entity_type.replace(/_/g, ' ')}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">by {who}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(a.created_at)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
