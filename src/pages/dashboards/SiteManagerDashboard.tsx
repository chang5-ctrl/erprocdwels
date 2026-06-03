import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, ClipboardList, FileText, MessageSquare } from 'lucide-react';
import { formatDate } from '@/lib/format';

export default function SiteManagerDashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [reqs, setReqs] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: p } = await supabase
        .from('projects')
        .select('id, name, status, location, start_date, expected_end_date')
        .eq('project_manager_id', user.id);
      setProjects(p ?? []);
      const ids = (p ?? []).map(x => x.id);

      const { data: r } = await supabase
        .from('requisitions')
        .select('id, requisition_number, status, requisition_date')
        .eq('status', 'new')
        .order('created_at', { ascending: false })
        .limit(10);
      setReqs(r ?? []);

      if (ids.length) {
        const { data: d } = await supabase
          .from('documents')
          .select('id, name, created_at')
          .in('project_id', ids)
          .order('created_at', { ascending: false })
          .limit(5);
        setDocs(d ?? []);
      } else setDocs([]);

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
        <h1 className="text-2xl font-bold">Site Manager Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your site, requisitions and documents</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile icon={<Building2 className="h-4 w-4" />} label="My Projects" value={String(projects.length)} />
        <Tile icon={<ClipboardList className="h-4 w-4" />} label="Requisitions to Confirm" value={String(reqs.length)} />
        <Tile icon={<MessageSquare className="h-4 w-4" />} label="Unread Messages" value={String(unread)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Assigned Sites</CardTitle></CardHeader>
        <CardContent>
          {projects.length === 0 ? <p className="text-sm text-muted-foreground">No assigned project.</p> : (
            <ul className="space-y-3">
              {projects.map(p => (
                <li key={p.id} className="rounded-md border p-3">
                  <div className="flex justify-between items-center mb-1">
                    <Link to={`/projects/${p.id}`} className="font-medium text-primary hover:underline">{p.name}</Link>
                    <Badge variant="secondary" className="capitalize">{p.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.location || '—'}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Pending Requisitions</CardTitle></CardHeader>
          <CardContent>
            {reqs.length === 0 ? <p className="text-sm text-muted-foreground">Nothing to confirm.</p> : (
              <ul className="divide-y">
                {reqs.map(r => (
                  <li key={r.id} className="py-2 flex justify-between text-sm">
                    <span className="font-mono">{r.requisition_number}</span>
                    <span className="text-muted-foreground">{formatDate(r.requisition_date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Recent Documents</CardTitle></CardHeader>
          <CardContent>
            {docs.length === 0 ? <p className="text-sm text-muted-foreground">No documents yet.</p> : (
              <ul className="divide-y">
                {docs.map(d => (
                  <li key={d.id} className="py-2 flex justify-between text-sm">
                    <span className="truncate">{d.name}</span>
                    <span className="text-muted-foreground">{formatDate(d.created_at)}</span>
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

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center justify-between mb-2 text-muted-foreground">
        <span className="text-xs uppercase tracking-wide">{label}</span>{icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </CardContent></Card>
  );
}
