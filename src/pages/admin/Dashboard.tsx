import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, FileSpreadsheet, Users, Activity } from 'lucide-react';
import { formatDate } from '@/lib/format';

interface Stats {
  projects: number;
  costSheets: number;
  staff: number;
  activitiesToday: number;
}

interface ActivityRow {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  user_id: string | null;
  details: Record<string, unknown> | null;
}

export default function AdminDashboard() {
  const { hasRole, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [logins, setLogins] = useState<Array<{ id: string; user_id: string; logged_in_at: string; user_agent: string | null }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!hasRole('admin')) return;

    const load = async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [projectsRes, sheetsRes, staffRes, activitiesRes, recentRes, loginsRes] = await Promise.all([
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('job_cost_sheets').select('*', { count: 'exact', head: true }),
        supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(15),
        supabase.from('login_logs').select('*').order('logged_in_at', { ascending: false }).limit(10),
      ]);

      setStats({
        projects: projectsRes.count ?? 0,
        costSheets: sheetsRes.count ?? 0,
        staff: staffRes.count ?? 0,
        activitiesToday: activitiesRes.count ?? 0,
      });
      setActivity((recentRes.data ?? []) as ActivityRow[]);
      setLogins((loginsRes.data ?? []) as typeof logins);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authLoading, hasRole]);

  if (authLoading) return null;
  if (!hasRole('admin')) return <Navigate to="/projects" replace />;

  const cards = [
    { label: 'Projects', value: stats?.projects ?? 0, icon: Building2 },
    { label: 'Cost Sheets', value: stats?.costSheets ?? 0, icon: FileSpreadsheet },
    { label: 'Staff', value: stats?.staff ?? 0, icon: Users },
    { label: "Today's Activity", value: stats?.activitiesToday ?? 0, icon: Activity },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <c.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold">{loading ? '—' : c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
              : activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet</p>
              : (
                <ul className="space-y-2 text-sm">
                  {activity.map(a => (
                    <li key={a.id} className="flex justify-between gap-2 border-b pb-2 last:border-0">
                      <span><span className="font-medium">{a.action}</span> · {a.entity_type}</span>
                      <span className="text-muted-foreground text-xs whitespace-nowrap">{formatDate(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent Logins</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
              : logins.length === 0 ? <p className="text-sm text-muted-foreground">No login records yet</p>
              : (
                <ul className="space-y-2 text-sm">
                  {logins.map(l => (
                    <li key={l.id} className="flex justify-between gap-2 border-b pb-2 last:border-0">
                      <span className="truncate text-xs text-muted-foreground">{l.user_agent?.slice(0, 50) ?? 'unknown'}</span>
                      <span className="text-muted-foreground text-xs whitespace-nowrap">{formatDate(l.logged_in_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
