import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Building2, FileSpreadsheet, ClipboardList, MessageSquare } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

export default function ProjectManagerDashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [sheets, setSheets] = useState<any[]>([]);
  const [reqs, setReqs] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: p } = await supabase
        .from('projects')
        .select('id, name, status, budget_total, budget_spent')
        .eq('project_manager_id', user.id)
        .order('created_at', { ascending: false });
      setProjects(p ?? []);
      const projIds = (p ?? []).map(x => x.id);

      if (projIds.length) {
        const { data: s } = await supabase
          .from('job_cost_sheets')
          .select('id, name, status, amount, sheet_date, projects(name)')
          .in('project_id', projIds)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(10);
        setSheets(s ?? []);
      } else setSheets([]);

      const { data: r } = await supabase
        .from('requisitions')
        .select('id, requisition_number, status, requisition_date')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setReqs(r ?? []);

      // unread chat
      const { data: members } = await supabase
        .from('chat_channel_members')
        .select('channel_id, last_read_at')
        .eq('user_id', user.id);
      let total = 0;
      for (const m of members ?? []) {
        const { count } = await supabase
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('channel_id', m.channel_id)
          .gt('created_at', m.last_read_at)
          .neq('sender_id', user.id);
        total += count || 0;
      }
      setUnread(total);
    };
    load();
  }, [user?.id]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Project Manager Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your projects, cost sheets and requisitions</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile icon={<Building2 className="h-4 w-4" />} label="My Projects" value={String(projects.length)} />
        <StatTile icon={<FileSpreadsheet className="h-4 w-4" />} label="Pending Cost Sheets" value={String(sheets.length)} />
        <StatTile icon={<MessageSquare className="h-4 w-4" />} label="Unread Messages" value={String(unread)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">My Assigned Projects</CardTitle></CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects assigned to you yet.</p>
          ) : (
            <ul className="space-y-3">
              {projects.map(p => {
                const pct = Number(p.budget_total) > 0
                  ? Math.min(100, Math.round((Number(p.budget_spent) / Number(p.budget_total)) * 100))
                  : 0;
                return (
                  <li key={p.id} className="rounded-md border p-3">
                    <div className="flex justify-between items-center mb-2">
                      <Link to={`/projects/${p.id}`} className="font-medium text-primary hover:underline">{p.name}</Link>
                      <Badge variant="secondary" className="capitalize">{p.status}</Badge>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{formatCurrency(Number(p.budget_spent || 0))} / {formatCurrency(Number(p.budget_total || 0))}</span>
                      <span>{pct}%</span>
                    </div>
                    <Progress value={pct} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Pending Cost Sheets</CardTitle></CardHeader>
          <CardContent>
            {sheets.length === 0 ? <p className="text-sm text-muted-foreground">No pending sheets.</p> : (
              <ul className="divide-y">
                {sheets.map(s => (
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
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" /> My Requisitions</CardTitle></CardHeader>
          <CardContent>
            {reqs.length === 0 ? <p className="text-sm text-muted-foreground">No requisitions yet.</p> : (
              <ul className="divide-y">
                {reqs.map(r => (
                  <li key={r.id} className="py-2 flex justify-between text-sm">
                    <span className="font-mono">{r.requisition_number}</span>
                    <Badge variant="secondary" className="capitalize">{r.status}</Badge>
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

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2 text-muted-foreground">
          <span className="text-xs uppercase tracking-wide">{label}</span>{icon}
        </div>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
