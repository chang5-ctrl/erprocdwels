import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MilestoneList from '@/pages/milestones/MilestoneList';
import { ArrowLeft, Building2, FileText, Users, Wallet, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate, statusColors, statusLabels, stateLabels, stateColors } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

type Project = Tables<'projects'>;
type CostSheet = Tables<'job_cost_sheets'>;
type Document = Tables<'documents'>;
type Profile = Tables<'user_profiles'>;

function progressColor(pct: number) {
  if (pct >= 90) return '[&>div]:bg-destructive';
  if (pct >= 70) return '[&>div]:bg-accent';
  return '[&>div]:bg-primary';
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [manager, setManager] = useState<Profile | null>(null);
  const [sheets, setSheets] = useState<CostSheet[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: p } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
      if (!p) { toast.error('Project not found'); navigate('/projects'); return; }
      setProject(p);
      const [{ data: cs }, { data: dc }, { data: st }] = await Promise.all([
        supabase.from('job_cost_sheets').select('*').eq('project_id', id).order('created_at', { ascending: false }),
        supabase.from('documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
        supabase.from('user_profiles').select('*').eq('is_active', true).order('full_name'),
      ]);
      setSheets(cs ?? []);
      setDocs(dc ?? []);
      setStaff((st ?? []) as Profile[]);
      if (p.project_manager_id) {
        const mgr = (st ?? []).find((s: Profile) => s.user_id === p.project_manager_id) ?? null;
        setManager(mgr);
      }
      setLoading(false);
    })();
  }, [id]);

  const updateStatus = async (status: string) => {
    if (!project) return;
    const { error } = await supabase.from('projects').update({ status }).eq('id', project.id);
    if (error) return toast.error(error.message);
    setProject({ ...project, status });
    toast.success('Status updated');
  };

  if (loading || !project) {
    return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  const total = Number(project.budget_total ?? 0);
  const spent = Number(project.budget_spent ?? 0);
  const remaining = total - spent;
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/projects')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Projects
        </Button>
        <Select value={project.status} onValueChange={updateStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="handover">Handover</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-2xl">{project.name}</CardTitle>
                <Badge variant="secondary" className={statusColors[project.status]}>
                  {statusLabels[project.status] || project.status}
                </Badge>
              </div>
              {project.description && <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 text-sm">
          <div><div className="text-muted-foreground">Client</div><div className="font-medium">{project.customer_name || '—'}</div></div>
          <div><div className="text-muted-foreground">Location</div><div className="font-medium">{project.location || '—'}</div></div>
          <div><div className="text-muted-foreground">Project Manager</div><div className="font-medium">{manager?.full_name || '—'}</div></div>
          <div><div className="text-muted-foreground">Start Date</div><div className="font-medium">{project.start_date ? formatDate(project.start_date) : '—'}</div></div>
          <div><div className="text-muted-foreground">Expected End</div><div className="font-medium">{project.expected_end_date ? formatDate(project.expected_end_date) : '—'}</div></div>
          <div><div className="text-muted-foreground">Created</div><div className="font-medium">{formatDate(project.created_at)}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /><CardTitle>Budget vs Spent</CardTitle></div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4"><div className="text-xs text-muted-foreground">Contract Value</div><div className="text-xl font-semibold">{formatCurrency(total)}</div></div>
            <div className="rounded-lg border p-4"><div className="text-xs text-muted-foreground">Spent</div><div className="text-xl font-semibold">{formatCurrency(spent)}</div></div>
            <div className="rounded-lg border p-4"><div className="text-xs text-muted-foreground">Remaining</div><div className={cn('text-xl font-semibold', remaining < 0 && 'text-destructive')}>{formatCurrency(remaining)}</div></div>
          </div>
          {total > 0 && (
            <div className="space-y-1">
              <Progress value={pct} className={cn('h-3', progressColor(pct))} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>{pct.toFixed(1)}% used</span><span>{(100 - pct).toFixed(1)}% left</span></div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><CardTitle>Job Cost Sheets ({sheets.length})</CardTitle></div>
          </CardHeader>
          <CardContent>
            {sheets.length === 0 ? <p className="text-sm text-muted-foreground">No cost sheets linked.</p> : (
              <ul className="space-y-2">
                {sheets.map(s => (
                  <li key={s.id} className="flex items-center justify-between rounded border p-3">
                    <Link to={`/job-cost-sheets/${s.id}`} className="font-medium text-primary hover:underline">{s.name}</Link>
                    <div className="flex items-center gap-2 text-sm">
                      <span>{formatCurrency(Number(s.total_planned_cost ?? 0))}</span>
                      <Badge variant="secondary" className={stateColors[s.state]}>{stateLabels[s.state] || s.state}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><CardTitle>Documents ({docs.length})</CardTitle></div>
          </CardHeader>
          <CardContent>
            {docs.length === 0 ? <p className="text-sm text-muted-foreground">No documents linked.</p> : (
              <ul className="space-y-2">
                {docs.map(d => (
                  <li key={d.id} className="flex items-center justify-between rounded border p-3">
                    <span className="truncate font-medium">{d.name}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(d.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><CardTitle>Assigned Staff</CardTitle></div>
        </CardHeader>
        <CardContent>
          {manager ? (
            <div className="rounded border p-3">
              <div className="font-medium">{manager.full_name}</div>
              <div className="text-xs text-muted-foreground">Project Manager{manager.job_title ? ` • ${manager.job_title}` : ''}</div>
            </div>
          ) : <p className="text-sm text-muted-foreground">No project manager assigned.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
