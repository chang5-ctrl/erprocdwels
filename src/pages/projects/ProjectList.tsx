import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { capabilitiesFor } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Building2 } from 'lucide-react';
import { formatCurrency, formatDate, statusLabels, statusColors } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';
import ProjectDialog from './ProjectDialog';
import RowDeleteButton from '@/components/RowDeleteButton';

type Project = Tables<'projects'>;
const STATUS_TABS = ['all', 'active', 'completed', 'on_hold', 'handover'] as const;
type StatusTab = typeof STATUS_TABS[number];

function progressColor(pct: number) {
  if (pct >= 90) return '[&>div]:bg-destructive';
  if (pct >= 70) return '[&>div]:bg-accent';
  return '[&>div]:bg-primary';
}

export default function ProjectList() {
  const { user, roles } = useAuth();
  const caps = useMemo(() => capabilitiesFor(roles), [roles]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusTab>('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    let q = supabase.from('projects').select('*').filter('deleted_at', 'is', null).order('created_at', { ascending: false });
    if (!caps.viewAllProjects && user) {
      q = q.eq('project_manager_id', user.id);
    }
    const { data } = await q;
    setProjects(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
    const channel = supabase
      .channel('projects-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchProjects())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [caps.viewAllProjects, user?.id]);

  const filtered = useMemo(
    () => filter === 'all' ? projects : projects.filter(p => p.status === filter),
    [projects, filter],
  );

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
        </div>
        {caps.createProject && (
          <Button onClick={() => setDialogOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Project</Button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b">
        {STATUS_TABS.map(tab => {
          const count = tab === 'all' ? projects.length : projects.filter(p => p.status === tab).length;
          const active = filter === tab;
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab === 'all' ? 'All' : statusLabels[tab]} <span className="ml-1 text-xs opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Building2 className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No projects found.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Budget Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                {caps.createProject && <TableHead className="w-12 text-right"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => {
                const total = Number(p.budget_total ?? 0);
                const spent = Number(p.budget_spent ?? 0);
                const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link to={`/projects/${p.id}`} className="font-medium text-primary hover:underline">
                        {p.name}
                      </Link>
                      {p.location && <div className="text-xs text-muted-foreground">{p.location}</div>}
                    </TableCell>
                    <TableCell>{p.customer_name || '—'}</TableCell>
                    <TableCell className="min-w-[200px]">
                      {total > 0 ? (
                        <div className="space-y-1">
                          <Progress value={pct} className={cn('h-2', progressColor(pct))} />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{formatCurrency(spent)} / {formatCurrency(total)}</span>
                            <span>{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">No budget set</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[p.status]}>
                        {statusLabels[p.status] || p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                    {caps.createProject && (
                      <TableCell className="text-right">
                        <RowDeleteButton table="projects" id={p.id} label={p.name} onDeleted={fetchProjects} />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchProjects} />
    </div>
  );
}
